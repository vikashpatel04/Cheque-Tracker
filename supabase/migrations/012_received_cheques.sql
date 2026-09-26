-- Received cheques: cheques other people give you. See docs/received-cheques.md.
--
-- They have their own tables, separate from the cheques you give (cheques),
-- so each side can grow its own fields. Existing tables are unchanged, so
-- cheque-mcp and Cheque Watch keep working. The all_cheques view combines both
-- sides for shared screens and respects row-level security.
--
-- Life cycle (each change goes through a function below and is written to
-- received_cheque_history):
--   IN_HAND   ──► DEPOSITED ──► CLEARED
--   IN_HAND   ──► SETTLED | HANDED_BACK | WRITTEN_OFF | REPLACED
--   DEPOSITED ──► BOUNCED
--   BOUNCED   ──► deposit again ──► DEPOSITED (now) or IN_HAND (on a new date)
--   BOUNCED   ──► SETTLED | WRITTEN_OFF | REPLACED (a new cheque is linked)
-- CLEARED, SETTLED, HANDED_BACK, WRITTEN_OFF and REPLACED are final. Any change
-- can be undone one step at a time with rollback_received_cheque.
--
-- Security cheques (kind = 'SECURITY') are held rather than deposited on a
-- date; their amount and date may be blank, and due_date is when to review
-- them (for example the end of a lease or loan).

-- ---------------------------------------------------------------------------
-- Settings: how long a deposit usually takes to clear.
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS clearing_days smallint;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_clearing_days_range CHECK (clearing_days BETWEEN 0 AND 30);

COMMENT ON COLUMN public.settings.clearing_days IS
  'Days a deposited cheque usually takes to clear. After this the app asks whether it cleared.';

-- ---------------------------------------------------------------------------
-- bank_accounts: the user's own accounts. Only a name, the bank and the last
-- four characters of the account number are stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users,
  name       text NOT NULL CHECK (btrim(name) <> ''),
  bank_name  text NOT NULL CHECK (btrim(bank_name) <> ''),
  last4      text CHECK (last4 ~ '^[0-9A-Za-z]{4}$'),
  is_default boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bank_accounts IS
  'The user''s own bank accounts. Received cheques are deposited into one.';

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON public.bank_accounts (user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_one_default
  ON public.bank_accounts (user_id) WHERE is_default AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- received_cheques
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.received_cheques (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users,
  party_id           uuid NOT NULL REFERENCES public.parties(id),
  kind               text NOT NULL DEFAULT 'REGULAR' CHECK (kind IN ('REGULAR', 'SECURITY')),
  cheque_number      text NOT NULL CHECK (btrim(cheque_number) <> ''),
  bank_name          text NOT NULL CHECK (btrim(bank_name) <> ''),
  amount             numeric(12,2) CHECK (amount > 0),
  received_on        date NOT NULL,
  cheque_date        date,
  due_date           date NOT NULL,
  status             text NOT NULL DEFAULT 'IN_HAND' CHECK (status IN (
                       'IN_HAND', 'DEPOSITED', 'CLEARED', 'BOUNCED',
                       'SETTLED', 'HANDED_BACK', 'WRITTEN_OFF', 'REPLACED')),
  deposit_account_id uuid REFERENCES public.bank_accounts(id),
  deposited_on       date,
  cleared_on         date,
  bounced_on         date,
  bounce_reason      text,
  bank_charges       numeric(12,2) CHECK (bank_charges >= 0),
  settled_on         date,
  settled_via        text CHECK (settled_via IN ('CASH', 'TRANSFER', 'OTHER')),
  settlement_ref     text,
  close_reason       text,
  redeposit_count    integer NOT NULL DEFAULT 0 CHECK (redeposit_count >= 0),
  replaces_id        uuid REFERENCES public.received_cheques(id),
  series_id          uuid,
  series_index       integer CHECK (series_index > 0),
  notes              text,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Regular cheques need an amount and a date; security cheques may leave them blank.
  CONSTRAINT received_regular_complete
    CHECK (kind = 'SECURITY' OR (amount IS NOT NULL AND cheque_date IS NOT NULL))
);

COMMENT ON TABLE public.received_cheques IS
  'Cheques other people give the user. Status changes only through the received-cheque functions.';
COMMENT ON COLUMN public.received_cheques.bank_name IS 'The bank the cheque is drawn on (the payer''s bank).';
COMMENT ON COLUMN public.received_cheques.cheque_date IS 'Date written on the cheque. Validity is counted from it.';
COMMENT ON COLUMN public.received_cheques.due_date IS
  'When to deposit it (regular), or when to review it (security). Moves when a bounced cheque is to be deposited again later.';
COMMENT ON COLUMN public.received_cheques.bank_charges IS 'Charges from bounces, added up.';
COMMENT ON COLUMN public.received_cheques.redeposit_count IS 'Times deposited again after bouncing.';
COMMENT ON COLUMN public.received_cheques.replaces_id IS 'The cheque this one replaced.';
COMMENT ON COLUMN public.received_cheques.series_id IS 'Shared by cheques entered together, such as rent or EMI cheques.';

CREATE INDEX IF NOT EXISTS idx_received_user_status ON public.received_cheques (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_user_due ON public.received_cheques (user_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_party ON public.received_cheques (party_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_received_series ON public.received_cheques (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_received_replaces ON public.received_cheques (replaces_id) WHERE replaces_id IS NOT NULL;

CREATE TRIGGER received_cheques_updated_at
  BEFORE UPDATE ON public.received_cheques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- received_cheque_history: append-only; written only by the functions below.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.received_cheque_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cheque_id          uuid NOT NULL REFERENCES public.received_cheques(id),
  from_status        text NOT NULL,
  to_status          text NOT NULL,
  changed_by         text NOT NULL CHECK (changed_by IN ('manual', 'auto', 'rollback')),
  note               text,
  prev_state         jsonb NOT NULL,
  reverts_history_id uuid REFERENCES public.received_cheque_history(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_received_history_cheque ON public.received_cheque_history (cheque_id, created_at);

-- ---------------------------------------------------------------------------
-- Guard: status and the dates that go with it change only through the
-- functions below, so every change is checked and written to history. The
-- functions switch app.received_lifecycle on for their own transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_received_cheque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Foreign keys don't check row-level security, so make sure the party and
  -- the account belong to the user.
  IF (TG_OP = 'INSERT' OR NEW.party_id IS DISTINCT FROM OLD.party_id)
     AND NOT EXISTS (SELECT 1 FROM parties WHERE id = NEW.party_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Party not found' USING ERRCODE = '23503';
  END IF;
  IF NEW.deposit_account_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.deposit_account_id IS DISTINCT FROM OLD.deposit_account_id)
     AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = NEW.deposit_account_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Bank account not found' USING ERRCODE = '23503';
  END IF;

  IF coalesce(current_setting('app.received_lifecycle', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'IN_HAND'
       OR NEW.deposited_on IS NOT NULL OR NEW.cleared_on IS NOT NULL
       OR NEW.bounced_on IS NOT NULL OR NEW.settled_on IS NOT NULL
       OR NEW.redeposit_count <> 0 OR NEW.replaces_id IS NOT NULL THEN
      RAISE EXCEPTION 'New received cheques start in hand' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deposited_on IS DISTINCT FROM OLD.deposited_on
     OR NEW.cleared_on IS DISTINCT FROM OLD.cleared_on
     OR NEW.bounced_on IS DISTINCT FROM OLD.bounced_on
     OR NEW.settled_on IS DISTINCT FROM OLD.settled_on
     OR NEW.redeposit_count IS DISTINCT FROM OLD.redeposit_count
     OR NEW.replaces_id IS DISTINCT FROM OLD.replaces_id THEN
    RAISE EXCEPTION 'Change the status with the received-cheque actions' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER received_cheques_guard
  BEFORE INSERT OR UPDATE ON public.received_cheques
  FOR EACH ROW EXECUTE FUNCTION guard_received_cheque();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_cheque_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own bank accounts"
ON public.bank_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access own received cheques"
ON public.received_cheques FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own received cheque history"
ON public.received_cheque_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.received_cheques rc
    WHERE rc.id = received_cheque_history.cheque_id
    AND rc.user_id = auth.uid()
  )
);

CREATE POLICY "Actions can add history to own received cheques"
ON public.received_cheque_history FOR INSERT
WITH CHECK (
  coalesce(current_setting('app.received_lifecycle', true), '') = 'on'
  AND EXISTS (
    SELECT 1 FROM public.received_cheques rc
    WHERE rc.id = received_cheque_history.cheque_id
    AND rc.user_id = auth.uid()
  )
);

-- Plans (see migration 011): writes need an active plan on hosted instances.
CREATE POLICY "Inserts need an active plan" ON public.bank_accounts
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());
CREATE POLICY "Updates need an active plan" ON public.bank_accounts
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_write_access());
CREATE POLICY "Deletes need an active plan" ON public.bank_accounts
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_write_access());

CREATE POLICY "Inserts need an active plan" ON public.received_cheques
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());
CREATE POLICY "Updates need an active plan" ON public.received_cheques
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_write_access());
CREATE POLICY "Deletes need an active plan" ON public.received_cheques
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_write_access());

CREATE POLICY "Inserts need an active plan" ON public.received_cheque_history
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());

-- ---------------------------------------------------------------------------
-- Helpers, in a schema the API doesn't expose.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

CREATE OR REPLACE FUNCTION internal.received_snapshot(c public.received_cheques)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status',             c.status,
    'due_date',           c.due_date,
    'deposit_account_id', c.deposit_account_id,
    'deposited_on',       c.deposited_on,
    'cleared_on',         c.cleared_on,
    'bounced_on',         c.bounced_on,
    'bounce_reason',      c.bounce_reason,
    'bank_charges',       c.bank_charges,
    'settled_on',         c.settled_on,
    'settled_via',        c.settled_via,
    'settlement_ref',     c.settlement_ref,
    'close_reason',       c.close_reason,
    'redeposit_count',    c.redeposit_count
  );
$$;

-- Lock a cheque for a change and allow the change for this transaction.
CREATE OR REPLACE FUNCTION internal.lock_received(p_cheque_id uuid)
RETURNS public.received_cheques
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  -- Signed-in users need write access (see migration 011). Server jobs using
  -- the service role have no auth.uid() and aren't limited by plans.
  IF auth.uid() IS NOT NULL AND NOT public.has_write_access() THEN
    RAISE EXCEPTION 'Your plan has ended. Renew it to make changes.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM received_cheques
  WHERE id = p_cheque_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.received_lifecycle', 'on', true);
  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION internal.log_received(
  c            public.received_cheques,
  p_to_status  text,
  p_note       text,
  p_changed_by text DEFAULT 'manual'
)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  -- clock_timestamp() so several changes in one transaction keep their order.
  INSERT INTO received_cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (c.id, c.status, p_to_status, p_changed_by, nullif(btrim(p_note), ''), internal.received_snapshot(c), clock_timestamp());
$$;

-- ---------------------------------------------------------------------------
-- Actions. All are SECURITY INVOKER, so row-level security applies, and each
-- writes a history row with the previous state for rollback.
-- ---------------------------------------------------------------------------

-- IN_HAND -> DEPOSITED, for one or more cheques at once (all or nothing).
CREATE OR REPLACE FUNCTION public.deposit_received_cheques(
  p_cheque_ids   uuid[],
  p_deposited_on date,
  p_account_id   uuid DEFAULT NULL,
  p_note         text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  c       public.received_cheques;
  v_count integer := 0;
BEGIN
  IF p_deposited_on IS NULL THEN
    RAISE EXCEPTION 'A deposit date is required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(array_length(p_cheque_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Choose at least one cheque' USING ERRCODE = '22023';
  END IF;

  FOREACH v_id IN ARRAY p_cheque_ids LOOP
    c := internal.lock_received(v_id);
    IF c.status <> 'IN_HAND' THEN
      RAISE EXCEPTION 'Only cheques in hand can be deposited (cheque %)', c.cheque_number USING ERRCODE = '22023';
    END IF;
    IF c.amount IS NULL OR c.cheque_date IS NULL THEN
      RAISE EXCEPTION 'Add the amount and date to cheque % before depositing it', c.cheque_number USING ERRCODE = '22023';
    END IF;

    UPDATE received_cheques
    SET status             = 'DEPOSITED',
        deposited_on       = p_deposited_on,
        deposit_account_id = coalesce(p_account_id, deposit_account_id)
    WHERE id = v_id;

    PERFORM internal.log_received(c, 'DEPOSITED', p_note);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- DEPOSITED -> CLEARED, for one or more cheques at once (all or nothing).
CREATE OR REPLACE FUNCTION public.clear_received_cheques(
  p_cheque_ids uuid[],
  p_cleared_on date,
  p_note       text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  c       public.received_cheques;
  v_count integer := 0;
BEGIN
  IF p_cleared_on IS NULL THEN
    RAISE EXCEPTION 'A clearing date is required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(array_length(p_cheque_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Choose at least one cheque' USING ERRCODE = '22023';
  END IF;

  FOREACH v_id IN ARRAY p_cheque_ids LOOP
    c := internal.lock_received(v_id);
    IF c.status <> 'DEPOSITED' THEN
      RAISE EXCEPTION 'Only deposited cheques can clear (cheque %)', c.cheque_number USING ERRCODE = '22023';
    END IF;
    IF p_cleared_on < c.deposited_on THEN
      RAISE EXCEPTION 'Cheque % can''t clear before it was deposited', c.cheque_number USING ERRCODE = '22023';
    END IF;

    UPDATE received_cheques SET status = 'CLEARED', cleared_on = p_cleared_on WHERE id = v_id;
    PERFORM internal.log_received(c, 'CLEARED', p_note);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- DEPOSITED -> BOUNCED, with the reason and any bank charges.
CREATE OR REPLACE FUNCTION public.bounce_received_cheque(
  p_cheque_id    uuid,
  p_bounced_on   date,
  p_reason       text,
  p_bank_charges numeric DEFAULT NULL,
  p_note         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A bounce reason is required' USING ERRCODE = '22023';
  END IF;
  IF p_bounced_on IS NULL THEN
    RAISE EXCEPTION 'The bounce date is required' USING ERRCODE = '22023';
  END IF;
  IF p_bank_charges < 0 THEN
    RAISE EXCEPTION 'Bank charges can''t be negative' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status <> 'DEPOSITED' THEN
    RAISE EXCEPTION 'Only deposited cheques can bounce' USING ERRCODE = '22023';
  END IF;
  IF p_bounced_on < c.deposited_on THEN
    RAISE EXCEPTION 'A cheque can''t bounce before it was deposited' USING ERRCODE = '22023';
  END IF;

  UPDATE received_cheques
  SET status        = 'BOUNCED',
      bounced_on    = p_bounced_on,
      bounce_reason = btrim(p_reason),
      bank_charges  = CASE WHEN p_bank_charges IS NULL THEN bank_charges
                           ELSE coalesce(bank_charges, 0) + p_bank_charges END
  WHERE id = p_cheque_id;

  PERFORM internal.log_received(c, 'BOUNCED', concat_ws(' · ',
    'Bounced: ' || btrim(p_reason),
    CASE WHEN p_bank_charges > 0 THEN 'bank charges ' || p_bank_charges::text END,
    nullif(btrim(p_note), '')
  ));
END;
$$;

-- BOUNCED -> DEPOSITED (deposited again now) or IN_HAND (to deposit on p_date).
CREATE OR REPLACE FUNCTION public.redeposit_received_cheque(
  p_cheque_id   uuid,
  p_date        date,
  p_deposit_now boolean DEFAULT true,
  p_account_id  uuid DEFAULT NULL,
  p_note        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c      public.received_cheques;
  v_note text;
BEGIN
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'A date is required' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status <> 'BOUNCED' THEN
    RAISE EXCEPTION 'Only bounced cheques can be deposited again' USING ERRCODE = '22023';
  END IF;

  v_note := concat_ws(' · ',
    CASE WHEN p_deposit_now THEN 'Deposited again'
         ELSE 'To deposit again on ' || to_char(p_date, 'YYYY-MM-DD') END,
    'bounced ' || to_char(c.bounced_on, 'YYYY-MM-DD') || ': ' || c.bounce_reason,
    nullif(btrim(p_note), '')
  );

  IF p_deposit_now THEN
    IF p_date < c.bounced_on THEN
      RAISE EXCEPTION 'The new deposit can''t be before the bounce' USING ERRCODE = '22023';
    END IF;
    UPDATE received_cheques
    SET status             = 'DEPOSITED',
        deposited_on       = p_date,
        deposit_account_id = coalesce(p_account_id, deposit_account_id),
        cleared_on         = NULL,
        redeposit_count    = redeposit_count + 1
    WHERE id = p_cheque_id;
    PERFORM internal.log_received(c, 'DEPOSITED', v_note);
  ELSE
    UPDATE received_cheques
    SET status             = 'IN_HAND',
        due_date           = p_date,
        deposited_on       = NULL,
        deposit_account_id = coalesce(p_account_id, deposit_account_id),
        redeposit_count    = redeposit_count + 1
    WHERE id = p_cheque_id;
    PERFORM internal.log_received(c, 'IN_HAND', v_note);
  END IF;
END;
$$;

-- IN_HAND or BOUNCED -> SETTLED: the payer paid another way.
CREATE OR REPLACE FUNCTION public.settle_received_cheque(
  p_cheque_id  uuid,
  p_via        text,
  p_settled_on date,
  p_reference  text DEFAULT NULL,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  IF p_via IS NULL OR p_via NOT IN ('CASH', 'TRANSFER', 'OTHER') THEN
    RAISE EXCEPTION 'Choose how it was paid' USING ERRCODE = '22023';
  END IF;
  IF p_settled_on IS NULL THEN
    RAISE EXCEPTION 'The payment date is required' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status NOT IN ('IN_HAND', 'BOUNCED') THEN
    RAISE EXCEPTION 'Only cheques in hand or bounced can be settled another way' USING ERRCODE = '22023';
  END IF;

  UPDATE received_cheques
  SET status         = 'SETTLED',
      settled_on     = p_settled_on,
      settled_via    = p_via,
      settlement_ref = nullif(btrim(p_reference), '')
  WHERE id = p_cheque_id;

  PERFORM internal.log_received(c, 'SETTLED', concat_ws(' · ',
    CASE p_via WHEN 'CASH' THEN 'Paid in cash'
               WHEN 'TRANSFER' THEN 'Paid by transfer'
               ELSE 'Paid another way' END,
    'ref ' || nullif(btrim(p_reference), ''),
    nullif(btrim(p_note), '')
  ));
END;
$$;

-- IN_HAND -> HANDED_BACK: given back to the payer (a cancelled deal, or a
-- security cheque at the end of a lease or loan).
CREATE OR REPLACE FUNCTION public.hand_back_received_cheque(
  p_cheque_id uuid,
  p_reason    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  c := internal.lock_received(p_cheque_id);
  IF c.status <> 'IN_HAND' THEN
    RAISE EXCEPTION 'Only cheques in hand can be handed back' USING ERRCODE = '22023';
  END IF;

  UPDATE received_cheques SET status = 'HANDED_BACK', close_reason = nullif(btrim(p_reason), '') WHERE id = p_cheque_id;
  PERFORM internal.log_received(c, 'HANDED_BACK', concat_ws(' · ', 'Handed back', nullif(btrim(p_reason), '')));
END;
$$;

-- IN_HAND or BOUNCED -> WRITTEN_OFF: the money won't come (bad debt).
CREATE OR REPLACE FUNCTION public.write_off_received_cheque(
  p_cheque_id uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.received_cheques;
BEGIN
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A write-off reason is required' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status NOT IN ('IN_HAND', 'BOUNCED') THEN
    RAISE EXCEPTION 'Only cheques in hand or bounced can be written off' USING ERRCODE = '22023';
  END IF;

  UPDATE received_cheques SET status = 'WRITTEN_OFF', close_reason = btrim(p_reason) WHERE id = p_cheque_id;
  PERFORM internal.log_received(c, 'WRITTEN_OFF', 'Written off: ' || btrim(p_reason));
END;
$$;

-- IN_HAND or BOUNCED -> REPLACED: the payer gave a new cheque instead. The new
-- one is created in hand, linked through replaces_id. Returns its id.
CREATE OR REPLACE FUNCTION public.replace_received_cheque(
  p_cheque_id     uuid,
  p_cheque_number text,
  p_bank_name     text,
  p_amount        numeric,
  p_cheque_date   date,
  p_received_on   date,
  p_due_date      date DEFAULT NULL,
  p_notes         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        public.received_cheques;
  v_new_id uuid;
BEGIN
  IF coalesce(btrim(p_cheque_number), '') = '' THEN
    RAISE EXCEPTION 'The new cheque number is required' USING ERRCODE = '22023';
  END IF;

  c := internal.lock_received(p_cheque_id);
  IF c.status NOT IN ('IN_HAND', 'BOUNCED') THEN
    RAISE EXCEPTION 'Only cheques in hand or bounced can be replaced' USING ERRCODE = '22023';
  END IF;

  INSERT INTO received_cheques (
    user_id, party_id, kind, cheque_number, bank_name, amount,
    received_on, cheque_date, due_date, deposit_account_id, replaces_id, notes
  )
  VALUES (
    c.user_id, c.party_id, c.kind, btrim(p_cheque_number), btrim(p_bank_name), p_amount,
    p_received_on, p_cheque_date, coalesce(p_due_date, p_cheque_date, c.due_date),
    c.deposit_account_id, c.id, nullif(btrim(p_notes), '')
  )
  RETURNING id INTO v_new_id;

  UPDATE received_cheques SET status = 'REPLACED' WHERE id = p_cheque_id;
  PERFORM internal.log_received(c, 'REPLACED', 'Replaced by cheque ' || btrim(p_cheque_number));

  RETURN v_new_id;
END;
$$;

-- Undo the latest (not yet undone) change. Can be repeated to step further
-- back. Undoing a replacement also removes the replacement cheque, as long as
-- nothing has happened to it yet. Returns the status the cheque went back to.
CREATE OR REPLACE FUNCTION public.rollback_received_cheque(
  p_cheque_id uuid,
  p_note      text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c     public.received_cheques;
  h     public.received_cheque_history;
  v_new public.received_cheques;
  s     jsonb;
BEGIN
  c := internal.lock_received(p_cheque_id);

  SELECT * INTO h
  FROM received_cheque_history ch
  WHERE ch.cheque_id = p_cheque_id
    AND ch.reverts_history_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM received_cheque_history r
      WHERE r.cheque_id = p_cheque_id AND r.reverts_history_id = ch.id
    )
  ORDER BY ch.created_at DESC, ch.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no status change to undo' USING ERRCODE = '22023';
  END IF;
  IF h.to_status <> c.status THEN
    RAISE EXCEPTION 'Cheque history is out of sync (last change was to %, cheque is %)', h.to_status, c.status
      USING ERRCODE = '22023';
  END IF;

  IF c.status = 'REPLACED' THEN
    SELECT * INTO v_new FROM received_cheques
    WHERE replaces_id = c.id AND deleted_at IS NULL
    FOR UPDATE;
    IF FOUND THEN
      IF v_new.status <> 'IN_HAND'
         OR EXISTS (SELECT 1 FROM received_cheque_history WHERE cheque_id = v_new.id) THEN
        RAISE EXCEPTION 'The replacement cheque % has changed since; undo that first', v_new.cheque_number
          USING ERRCODE = '22023';
      END IF;
      UPDATE received_cheques SET deleted_at = now() WHERE id = v_new.id;
    END IF;
  END IF;

  s := h.prev_state;
  UPDATE received_cheques
  SET status             = s->>'status',
      due_date           = (s->>'due_date')::date,
      deposit_account_id = (s->>'deposit_account_id')::uuid,
      deposited_on       = (s->>'deposited_on')::date,
      cleared_on         = (s->>'cleared_on')::date,
      bounced_on         = (s->>'bounced_on')::date,
      bounce_reason      = s->>'bounce_reason',
      bank_charges       = (s->>'bank_charges')::numeric,
      settled_on         = (s->>'settled_on')::date,
      settled_via        = s->>'settled_via',
      settlement_ref     = s->>'settlement_ref',
      close_reason       = s->>'close_reason',
      redeposit_count    = coalesce((s->>'redeposit_count')::int, 0)
  WHERE id = p_cheque_id;

  INSERT INTO received_cheque_history
    (cheque_id, from_status, to_status, changed_by, note, prev_state, reverts_history_id, created_at)
  VALUES (
    p_cheque_id, c.status, s->>'status', 'rollback',
    concat_ws(' · ', 'Undid ' || h.from_status || ' → ' || h.to_status, nullif(btrim(p_note), '')),
    internal.received_snapshot(c), h.id, clock_timestamp()
  );

  RETURN s->>'status';
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_received_cheques(uuid[], date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_received_cheques(uuid[], date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bounce_received_cheque(uuid, date, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeposit_received_cheque(uuid, date, boolean, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_received_cheque(uuid, text, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hand_back_received_cheque(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_off_received_cheque(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_received_cheque(uuid, text, text, numeric, date, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_received_cheque(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_received_cheque() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_received_cheques(uuid[], date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_received_cheques(uuid[], date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bounce_received_cheque(uuid, date, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeposit_received_cheque(uuid, date, boolean, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_received_cheque(uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hand_back_received_cheque(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_received_cheque(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_received_cheque(uuid, text, text, numeric, date, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_received_cheque(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- all_cheques: both directions in one list, for shared screens (today,
-- calendar, party ledger). security_invoker makes it respect row-level
-- security; without it a view would show every user's rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.all_cheques
WITH (security_invoker = true) AS
SELECT
  c.id,
  'GIVEN'::text AS direction,
  c.user_id,
  c.party_id,
  'REGULAR'::text AS kind,
  c.cheque_number,
  c.bank_name,
  c.amount,
  coalesce(c.original_due_date, c.due_date) AS cheque_date,
  c.due_date,
  c.status,
  c.created_at,
  c.updated_at
FROM public.cheques c
WHERE c.deleted_at IS NULL
UNION ALL
SELECT
  r.id,
  'RECEIVED'::text,
  r.user_id,
  r.party_id,
  r.kind,
  r.cheque_number,
  r.bank_name,
  r.amount,
  r.cheque_date,
  r.due_date,
  r.status,
  r.created_at,
  r.updated_at
FROM public.received_cheques r
WHERE r.deleted_at IS NULL;

COMMENT ON VIEW public.all_cheques IS
  'Given (cheques) and received (received_cheques) cheques together. Status values depend on direction.';

REVOKE INSERT, UPDATE, DELETE ON public.all_cheques FROM anon, authenticated;
