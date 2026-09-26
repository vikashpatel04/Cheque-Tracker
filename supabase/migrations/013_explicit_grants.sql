-- Explicit privileges for the Data API roles.
--
-- Until now the app relied on Supabase's "automatically expose new tables"
-- default, which grants anon and authenticated everything on every new table
-- and leaves row-level security to do all the work. New projects can turn that
-- default off, and Supabase recommends doing so. This migration sets exactly
-- the privileges the app needs, whichever way a project is configured:
--
--   - Everything is revoked first, so the result is the same on every project.
--   - Signed-in users can read, add and change their own data (row-level
--     security still limits them to their own rows). They get no DELETE: the
--     app only ever soft-deletes, by setting deleted_at.
--   - Visitors who aren't signed in can read the instance config and nothing else.
--   - The service role (Edge Functions, cheque-mcp, operators) keeps full access.
--
-- Future migrations must grant what their new tables and views need.

REVOKE ALL ON TABLE
  public.parties,
  public.cheques,
  public.cheque_history,
  public.daily_deposits,
  public.settings,
  public.instance_config,
  public.entitlements,
  public.bank_accounts,
  public.received_cheques,
  public.received_cheque_history,
  public.all_cheques
FROM anon, authenticated;

-- Own data: read, add and change.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.parties,
  public.cheques,
  public.settings,
  public.bank_accounts,
  public.received_cheques
TO authenticated;

-- Funds added: written by record_deposit, never edited.
GRANT SELECT, INSERT ON TABLE public.daily_deposits TO authenticated;

-- History is append-only.
GRANT SELECT, INSERT ON TABLE public.cheque_history, public.received_cheque_history TO authenticated;

-- Read-only for users: plans, instance settings and the combined view.
GRANT SELECT ON TABLE public.entitlements, public.instance_config, public.all_cheques TO authenticated;

-- Visitors: only the instance settings (e.g. for a pricing or sign-up page).
GRANT SELECT ON TABLE public.instance_config TO anon;

-- Server-side code with the service role.
GRANT ALL ON TABLE
  public.parties,
  public.cheques,
  public.cheque_history,
  public.daily_deposits,
  public.settings,
  public.instance_config,
  public.entitlements,
  public.bank_accounts,
  public.received_cheques,
  public.received_cheque_history
TO service_role;
-- The combined view is read-only for everyone.
REVOKE ALL ON TABLE public.all_cheques FROM service_role;
GRANT SELECT ON TABLE public.all_cheques TO service_role;

-- Helpers the received-cheque actions call (not exposed through the API).
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, service_role;
