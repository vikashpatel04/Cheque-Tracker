-- Re-present, write-off and rollback.
--
-- The user is the cheque GIVER. A RETURNED cheque is one of theirs that bounced.
--   - Re-present: the party deposits the SAME cheque again. The cheque goes
--     back to PENDING (optionally straight to DEPOSITED) with a new expected
--     date, and then follows the normal life cycle. The printed date is kept
--     in original_due_date.
--   - Write-off: the cheque is unusable (wrong amount, spelling, etc.). It is
--     closed as WRITTEN_OFF with a reason; a new cheque can be issued and
--     linked via replaces_cheque_id.
--   - Rollback: undo the latest status change of any cheque, restoring the
--     fields that change touched. Recorded as a new history row.
--
-- Additive and backward compatible: only new nullable/defaulted columns and
-- new functions. Existing rows are not modified. Clients that don't know about
-- these columns (current frontend, cheque-mcp) keep working unchanged.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.cheques
  ADD COLUMN IF NOT EXISTS original_due_date  date,
  ADD COLUMN IF NOT EXISTS represent_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS write_off_reason   text,
  ADD COLUMN IF NOT EXISTS replaces_cheque_id uuid REFERENCES public.cheques(id);

COMMENT ON COLUMN public.cheques.original_due_date IS
  'Date printed on the cheque, kept when a returned cheque is re-presented with a new due_date.';
COMMENT ON COLUMN public.cheques.represent_count IS
  'How many times this returned cheque has been re-presented.';
COMMENT ON COLUMN public.cheques.write_off_reason IS
  'Why the cheque was written off (status WRITTEN_OFF).';
COMMENT ON COLUMN public.cheques.replaces_cheque_id IS
  'For a new cheque issued in place of a written-off one.';

ALTER TABLE public.cheque_history
  ADD COLUMN IF NOT EXISTS prev_state         jsonb,
  ADD COLUMN IF NOT EXISTS reverts_history_id uuid REFERENCES public.cheque_history(id);

COMMENT ON COLUMN public.cheque_history.prev_state IS
  'Cheque fields before this change, used to roll it back exactly.';
COMMENT ON COLUMN public.cheque_history.reverts_history_id IS
  'Set on rollback rows: the history row that was undone.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cheque_state_snapshot(c public.cheques)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status',                  c.status,
    'due_date',                c.due_date,
    'original_due_date',       c.original_due_date,
    'return_reason',           c.return_reason,
    'represent_count',         c.represent_count,
    'write_off_reason',        c.write_off_reason,
    'auto_transition_blocked', c.auto_transition_blocked
  );
$$;

-- Cheques re-presented with the old flow (a second cheque row was created)
-- are closed records; the new actions must not act on them.
CREATE OR REPLACE FUNCTION public.is_legacy_represented(c public.cheques)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(c.notes, '') LIKE '%[RE_PRESENTED]%';
$$;

-- ---------------------------------------------------------------------------
-- change_cheque_status: same behaviour as migration 007, now also stores the
-- previous state for rollback. Signature unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_cheque_status(
  p_cheque_id     uuid,
  p_new_status    text,
  p_changed_by    text DEFAULT 'manual',
  p_note          text DEFAULT NULL,
  p_return_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
BEGIN
  IF p_changed_by NOT IN ('manual', 'auto', 'deposit_allocation') THEN
    RAISE EXCEPTION 'Invalid changed_by: %', p_changed_by USING ERRCODE = '22023';
  END IF;

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;

  IF c.status = p_new_status THEN
    RETURN;
  END IF;

  -- Mirrors VALID_STATUS_TRANSITIONS in src/types/index.ts. Re-present and
  -- write-off have their own functions below.
  IF NOT (
       (c.status = 'PENDING'   AND p_new_status IN ('DEPOSITED', 'RETURNED', 'CANCELLED'))
    OR (c.status = 'DEPOSITED' AND p_new_status IN ('PASSED', 'RETURNED', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Cannot change status from % to %', c.status, p_new_status
      USING ERRCODE = '22023';
  END IF;

  IF p_new_status = 'RETURNED' AND coalesce(btrim(p_return_reason), '') = '' THEN
    RAISE EXCEPTION 'A return reason is required' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status        = p_new_status,
      return_reason = CASE WHEN p_new_status = 'RETURNED' THEN btrim(p_return_reason) ELSE return_reason END,
      auto_transition_blocked = CASE
        WHEN p_new_status = 'DEPOSITED' THEN false
        WHEN p_changed_by = 'auto' THEN auto_transition_blocked
        ELSE true
      END
  WHERE id = p_cheque_id;

  -- clock_timestamp() so several changes in one transaction keep their order.
  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, c.status, p_new_status, p_changed_by, p_note, cheque_state_snapshot(c), clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------------
-- represent_cheque: RETURNED -> PENDING (same cheque) with a new due date,
-- optionally followed by PENDING -> DEPOSITED.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.represent_cheque(
  p_cheque_id      uuid,
  p_new_due_date   date,
  p_note           text DEFAULT NULL,
  p_mark_deposited boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
  v_note text;
BEGIN
  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status <> 'RETURNED' THEN
    RAISE EXCEPTION 'Only returned cheques can be re-presented' USING ERRCODE = '22023';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was already re-presented with the old flow' USING ERRCODE = '22023';
  END IF;
  IF p_new_due_date IS NULL THEN
    RAISE EXCEPTION 'A new due date is required' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status            = 'PENDING',
      original_due_date = coalesce(original_due_date, due_date),
      due_date          = p_new_due_date,
      represent_count   = represent_count + 1,
      auto_transition_blocked = false
  WHERE id = p_cheque_id;

  v_note := concat_ws(' · ',
    'Re-presented (was due ' || to_char(c.due_date, 'DD/MM/YYYY') || ')',
    CASE WHEN c.return_reason IS NOT NULL THEN 'Returned: ' || c.return_reason END,
    nullif(btrim(p_note), '')
  );

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, 'RETURNED', 'PENDING', 'manual', v_note, cheque_state_snapshot(c), clock_timestamp());

  IF p_mark_deposited THEN
    PERFORM change_cheque_status(p_cheque_id, 'DEPOSITED', 'manual', 'Deposited on re-presentation');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- write_off_cheque: RETURNED -> WRITTEN_OFF (closed) with a reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_off_cheque(
  p_cheque_id uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
BEGIN
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A write-off reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.status <> 'RETURNED' THEN
    RAISE EXCEPTION 'Only returned cheques can be written off' USING ERRCODE = '22023';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was already re-presented with the old flow' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status           = 'WRITTEN_OFF',
      write_off_reason = btrim(p_reason),
      auto_transition_blocked = true
  WHERE id = p_cheque_id;

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, 'RETURNED', 'WRITTEN_OFF', 'manual', 'Written off: ' || btrim(p_reason), cheque_state_snapshot(c), clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------------
-- rollback_cheque_status: undo the latest (not yet undone) status change.
-- Can be repeated to step further back. Rows written without prev_state
-- (older rows, cheque-mcp) fall back to restoring just the status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollback_cheque_status(
  p_cheque_id uuid,
  p_note      text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.cheques;
  h public.cheque_history;
  s jsonb;
  v_target text;
BEGIN
  SELECT * INTO c FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;
  IF is_legacy_represented(c) THEN
    RAISE EXCEPTION 'This cheque was re-presented with the old flow and cannot be rolled back' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO h
  FROM cheque_history ch
  WHERE ch.cheque_id = p_cheque_id
    AND ch.reverts_history_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM cheque_history r
      WHERE r.cheque_id = p_cheque_id AND r.reverts_history_id = ch.id
    )
  ORDER BY ch.created_at DESC, ch.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no status change to roll back' USING ERRCODE = '22023';
  END IF;
  IF h.to_status <> c.status THEN
    RAISE EXCEPTION 'Cheque history is out of sync (last change was to %, cheque is %)', h.to_status, c.status
      USING ERRCODE = '22023';
  END IF;

  s := h.prev_state;
  v_target := h.from_status;

  IF s IS NOT NULL THEN
    UPDATE cheques
    SET status            = s->>'status',
        due_date          = (s->>'due_date')::date,
        original_due_date = (s->>'original_due_date')::date,
        return_reason     = s->>'return_reason',
        represent_count   = coalesce((s->>'represent_count')::int, 0),
        write_off_reason  = s->>'write_off_reason',
        -- A manual rollback keeps the auto-pass job from redoing the change.
        auto_transition_blocked = true
    WHERE id = p_cheque_id;
    v_target := s->>'status';
  ELSE
    UPDATE cheques
    SET status        = h.from_status,
        return_reason = CASE WHEN c.status = 'RETURNED' THEN NULL ELSE return_reason END,
        auto_transition_blocked = true
    WHERE id = p_cheque_id;
  END IF;

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, reverts_history_id, created_at)
  VALUES (
    p_cheque_id, c.status, v_target, 'rollback',
    concat_ws(' · ', 'Rolled back ' || h.from_status || ' → ' || h.to_status, nullif(btrim(p_note), '')),
    cheque_state_snapshot(c), h.id, clock_timestamp()
  );

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.cheque_state_snapshot(public.cheques) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_legacy_represented(public.cheques) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.represent_cheque(uuid, date, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_off_cheque(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_cheque_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cheque_state_snapshot(public.cheques) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_legacy_represented(public.cheques) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.represent_cheque(uuid, date, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_cheque(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_cheque_status(uuid, text) TO authenticated;
