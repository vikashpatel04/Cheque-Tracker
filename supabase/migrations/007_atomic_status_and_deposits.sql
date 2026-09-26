-- Atomic status changes and deposits, append-only history.
--
-- Additive and backward compatible: existing clients that update cheques and
-- insert history directly keep working. New frontend code calls these
-- functions instead so each operation is a single transaction.
--
-- Both functions are SECURITY INVOKER, so row-level security still applies:
-- a user can only touch their own cheques.

-- ---------------------------------------------------------------------------
-- change_cheque_status: validate + update + history row in one transaction.
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
  v_from text;
BEGIN
  IF p_changed_by NOT IN ('manual', 'auto', 'deposit_allocation') THEN
    RAISE EXCEPTION 'Invalid changed_by: %', p_changed_by USING ERRCODE = '22023';
  END IF;

  -- Lock the row so concurrent changes can't both read the same from-status.
  SELECT status INTO v_from
  FROM cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_from = p_new_status THEN
    RETURN;
  END IF;

  -- Mirrors VALID_STATUS_TRANSITIONS in src/types/index.ts
  IF NOT (
       (v_from = 'PENDING'   AND p_new_status IN ('DEPOSITED', 'RETURNED', 'CANCELLED'))
    OR (v_from = 'DEPOSITED' AND p_new_status IN ('PASSED', 'RETURNED', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Cannot change status from % to %', v_from, p_new_status
      USING ERRCODE = '22023';
  END IF;

  IF p_new_status = 'RETURNED' AND coalesce(btrim(p_return_reason), '') = '' THEN
    RAISE EXCEPTION 'A return reason is required' USING ERRCODE = '22023';
  END IF;

  UPDATE cheques
  SET status        = p_new_status,
      return_reason = CASE WHEN p_new_status = 'RETURNED' THEN btrim(p_return_reason) ELSE return_reason END,
      -- A DEPOSITED cheque must stay eligible for the auto-pass job; any other
      -- human-driven change locks the cheque against automatic transitions.
      auto_transition_blocked = CASE
        WHEN p_new_status = 'DEPOSITED' THEN false
        WHEN p_changed_by = 'auto' THEN auto_transition_blocked
        ELSE true
      END
  WHERE id = p_cheque_id;

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note)
  VALUES (p_cheque_id, v_from, p_new_status, p_changed_by, p_note);
END;
$$;

-- ---------------------------------------------------------------------------
-- record_deposit: log the deposit and mark allocated cheques DEPOSITED,
-- all or nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_deposit(
  p_amount       numeric,
  p_deposit_date date,
  p_cheque_ids   uuid[] DEFAULT '{}',
  p_notes        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deposit_id uuid;
  v_cheque_id  uuid;
  v_note       text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive' USING ERRCODE = '22023';
  END IF;

  INSERT INTO daily_deposits (user_id, amount, deposit_date, notes)
  VALUES (auth.uid(), p_amount, p_deposit_date, nullif(btrim(p_notes), ''))
  RETURNING id INTO v_deposit_id;

  v_note := CASE
    WHEN nullif(btrim(p_notes), '') IS NULL THEN 'Deposit allocation'
    ELSE 'Deposit allocation: ' || btrim(p_notes)
  END;

  FOREACH v_cheque_id IN ARRAY coalesce(p_cheque_ids, '{}') LOOP
    PERFORM public.change_cheque_status(v_cheque_id, 'DEPOSITED', 'deposit_allocation', v_note);
  END LOOP;

  RETURN v_deposit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_cheque_status(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_deposit(numeric, date, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_cheque_status(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_deposit(numeric, date, uuid[], text) TO authenticated;

-- ---------------------------------------------------------------------------
-- cheque_history becomes append-only for app users (read + insert only).
-- The service role (auto-pass job, cheque-mcp) bypasses RLS and is unaffected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can only access own cheque history" ON cheque_history;

CREATE POLICY "Users can read own cheque history"
ON cheque_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cheques
    WHERE cheques.id = cheque_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add history to own cheques"
ON cheque_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cheques
    WHERE cheques.id = cheque_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
);
