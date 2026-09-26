-- Per-user toggle for the daily auto-pass job.
--
-- When auto_pass_enabled = true (default, existing behavior):
--   - At auto_pass_time on the due_date, any PENDING/DEPOSITED cheque whose
--     auto_transition_blocked = false is set to PASSED.
--
-- When auto_pass_enabled = false:
--   - Instead of changing status, the edge function rolls the cheque's
--     due_date forward by one day so it shows up again tomorrow. Status,
--     amount, and party are untouched. auto_transition_blocked still suppresses
--     the roll-forward (so the user can lock a cheque in place if needed).

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS auto_pass_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.settings.auto_pass_enabled IS
  'When true, the daily job marks due cheques PASSED. When false, due cheques roll forward to the next day.';
