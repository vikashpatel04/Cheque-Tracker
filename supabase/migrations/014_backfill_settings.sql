-- Give every existing account a settings row.
--
-- handle_new_user() creates one at sign-up, but accounts created before the
-- migrations ran don't have one: for example a login added in the dashboard of
-- a brand-new project before its first deploy. The app needs the row, so add
-- it for them. Accounts that already have settings are left alone.

INSERT INTO public.settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
