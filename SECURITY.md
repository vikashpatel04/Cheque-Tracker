# Security Policy

Cheque Tracker holds financial records, so security reports are taken seriously.

## Supported versions

Only the latest `main` branch and the latest release are supported. Please make sure an issue still happens there before reporting it.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (or use [this link](https://github.com/vikashpatel04/cheque-tracker/security/advisories/new)).
3. Describe the problem, how to reproduce it, and what could be affected.

You should get a reply within 7 days. Once there's a fix, we'll agree on when to disclose it, and you'll be credited unless you'd rather not be.

For problems in the companion projects, report them in [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp/security) or [Cheque Watch](https://github.com/vikashpatel04/cheque-watch/security).

## How the app is secured

This is useful for reviewers and for anyone running their own copy:

- The web app only uses the Supabase **publishable (anon) key**, which is public by design. Access to data is controlled by **row-level security**, so each signed-in user can only read and change their own rows. The schema is public too, so RLS is the whole boundary.
- Status changes, deposits, re-present, write-off and rollback run as SQL functions with `SECURITY INVOKER`, so row-level security still applies. For app users, `cheque_history` is append-only.
- For received cheques, a trigger only lets those functions change a status, and only they can write history. The trigger also checks that the party and bank account belong to the user, since foreign keys skip row-level security.
- The `all_cheques` view is created with `security_invoker`, so it shows only the user's own rows.
- **Plans (hosted edition):**
  - `instance_config` and `entitlements` can be read but never written through the API. Only the service role can change them.
  - When billing is on, restrictive policies make an account without an active entitlement read-only. See [docs/editions.md](./docs/editions.md).
  - `tests/migrations.test.ts` checks these rules on every pull request.
- The **service-role key** is only used server-side: by the `auto-pass` Edge Function, and by [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp), which runs locally and filters every query by user id.

## If you run your own copy

- Never put the service-role key in a `VITE_*` variable or anywhere in the frontend. Everything with that prefix ends up in the browser bundle.
- Don't point cheque-mcp or Cheque Watch at a database that holds other people's data. Both use the service-role key, which can read every row.
- Keep row-level security enabled on every table.
- Keep `.env.local` out of git (it's ignored by default), and rotate any key that gets exposed.
- On a hosted Supabase project with a single user, turn off **Allow new users to sign up** under Authentication → Sign In / Providers. Otherwise anyone with your public key can create an account through the API. They'd only see their own empty data, but they'd still have an account.
- Turn on two-factor authentication for your Supabase, hosting and GitHub accounts.
