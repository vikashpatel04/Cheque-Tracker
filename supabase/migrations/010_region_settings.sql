-- Per-user region: currency, number and date formats, time zone, week start
-- and cheque validity. The app no longer assumes a country; each user picks
-- theirs on first sign-in (India is simply the first preset in the app).
--
-- Additive and backward compatible:
--   - New nullable columns. NULL country_code means "not chosen yet", and the
--     app asks on the next sign-in. Existing rows are not modified.
--   - New rows no longer get India-specific defaults (₹ and a list of Indian
--     banks); the app fills both from the country the user picks.
--   - currency_symbol stays and is kept in sync by the app, for older clients.
--   - History notes written by the database now use ISO dates (yyyy-MM-dd),
--     which the app shows in each user's own date format.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS country_code           text,
  ADD COLUMN IF NOT EXISTS currency_code          text,
  ADD COLUMN IF NOT EXISTS locale                 text,
  ADD COLUMN IF NOT EXISTS timezone               text,
  ADD COLUMN IF NOT EXISTS date_format            text,
  ADD COLUMN IF NOT EXISTS week_starts_on         smallint,
  ADD COLUMN IF NOT EXISTS cheque_validity_months smallint;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_country_code_format
    CHECK (country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT settings_currency_code_format
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT settings_date_format_allowed
    CHECK (date_format IN ('dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy', 'dd-MM-yyyy')),
  ADD CONSTRAINT settings_week_starts_on_allowed
    CHECK (week_starts_on IN (0, 1, 6)),
  ADD CONSTRAINT settings_cheque_validity_months_range
    CHECK (cheque_validity_months BETWEEN 1 AND 24);

COMMENT ON COLUMN public.settings.country_code IS
  'ISO 3166-1 alpha-2 country. NULL until the user picks a region in the app.';
COMMENT ON COLUMN public.settings.currency_code IS
  'ISO 4217 currency for all amounts.';
COMMENT ON COLUMN public.settings.locale IS
  'BCP 47 locale for number and month formatting, e.g. en-IN.';
COMMENT ON COLUMN public.settings.timezone IS
  'IANA time zone. "Today", due dates and auto_pass_time are in this zone.';
COMMENT ON COLUMN public.settings.date_format IS
  'How dates are shown and typed (date-fns pattern).';
COMMENT ON COLUMN public.settings.week_starts_on IS
  '0 = Sunday, 1 = Monday, 6 = Saturday.';
COMMENT ON COLUMN public.settings.cheque_validity_months IS
  'Months after its date that a cheque stays valid before banks treat it as stale.';
COMMENT ON COLUMN public.settings.currency_symbol IS
  'Symbol of currency_code, kept in sync by the app for older clients.';

ALTER TABLE public.settings ALTER COLUMN currency_symbol DROP DEFAULT;
ALTER TABLE public.settings ALTER COLUMN banks SET DEFAULT '{}'::text[];

-- ---------------------------------------------------------------------------
-- represent_cheque: same as migration 009, but the history note uses an ISO
-- date instead of DD/MM/YYYY, and says "Funded" to match the app.
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
    'Re-presented (was due ' || to_char(c.due_date, 'YYYY-MM-DD') || ')',
    CASE WHEN c.return_reason IS NOT NULL THEN 'Returned: ' || c.return_reason END,
    nullif(btrim(p_note), '')
  );

  INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by, note, prev_state, created_at)
  VALUES (p_cheque_id, 'RETURNED', 'PENDING', 'manual', v_note, cheque_state_snapshot(c), clock_timestamp());

  IF p_mark_deposited THEN
    PERFORM change_cheque_status(p_cheque_id, 'DEPOSITED', 'manual', 'Funded on re-presentation');
  END IF;
END;
$$;
