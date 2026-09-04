-- Remove roll-forward behavior and change auto_pass_enabled default to false.
--
-- New behavior:
--   - A cheque's due_date NEVER changes once set.
--   - auto_pass_enabled = true  → only DEPOSITED cheques are auto-marked PASSED.
--   - auto_pass_enabled = false (new default) → nothing happens automatically.
--   - PENDING cheques past their due_date are shown as "Overdue" in the UI.
--
-- Existing users who had auto_pass_enabled = true keep their setting.
-- New users default to false.

ALTER TABLE public.settings
  ALTER COLUMN auto_pass_enabled SET DEFAULT false;

COMMENT ON COLUMN public.settings.auto_pass_enabled IS
  'When true, the daily job marks DEPOSITED cheques as PASSED after their due date. When false, no automatic transitions occur. PENDING cheques are never auto-passed.';
