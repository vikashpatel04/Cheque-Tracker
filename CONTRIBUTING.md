# Contributing to Cheque Tracker

Thanks for helping out. Bug reports, fixes, features and documentation are all welcome.

## Where things go

| If it's about… | Open it in |
|---|---|
| The web app, its database migrations or the `auto-pass` function | This repo |
| The MCP server | [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp/issues) |
| The Wear OS app or the `watch-today` function | [Cheque Watch](https://github.com/vikashpatel04/cheque-watch/issues) |
| A security problem | Privately, as described in [SECURITY.md](./SECURITY.md). Please don't open a public issue. |

Before opening a new issue, search the existing ones. For anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

## Setting up

Follow [docs/self-hosting.md](./docs/self-hosting.md). Use a Supabase project of your own for development (the free tier is enough), or run one locally with `npx supabase start`. Use test data, never real cheques.

## Making a change

1. Fork the repo and create a branch from `main`, for example `fix/allocation-rounding`.
2. Make your change, keeping it focused on one thing.
3. Run the same checks as CI:
   ```bash
   npm run lint    # must pass with no errors
   npm test        # formatter tests, plus every migration with RLS checks
   npm run build   # type-check + production build
   ```
4. Try it in the browser, including at phone width. Most of the app is used on phones.
5. Sign off your commits (see below) and open a pull request using the template.

### Sign-off (DCO)

Every commit needs a `Signed-off-by` line, which certifies that you wrote the change or have the right to submit it under this project's license. The terms are the [Developer Certificate of Origin](https://developercertificate.org/). Add the line with `-s`:

```bash
git commit -s -m "fix(reports): count funded cheques in the weekly total"
```

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(cheques): warn when a cheque number is already in use
fix(auto-pass): use each user's own time zone
docs(regions): add New Zealand
```

## Project conventions

- **UI:** build with the shadcn/ui components in `src/components/ui` and Tailwind. Match the existing look rather than adding new styles.
- **No country is hardcoded.** Currency, number and date formats, time zone, week start and cheque rules come from the user's region. Use the helpers in `src/lib/formatters.ts` (`formatCurrency`, `formatDate`, `todayISO`, …) and never a fixed symbol, locale or date pattern. See [docs/regions.md](./docs/regions.md).
- **Status changes go through the database.** Use the wrappers in `src/lib/updateChequeStatus.ts`, which call SQL functions such as `change_cheque_status` and `record_deposit`. Every change is then atomic and written to history. Don't update `cheques.status` directly from the client.
- **Keep the transition rules in sync.** `VALID_STATUS_TRANSITIONS` in `src/types/index.ts` (given cheques) and `RECEIVED_ACTIONS` in `src/types/received.ts` (received cheques) mirror the checks in the SQL functions. If you change one, change the other; `tests/received.test.ts` checks the received side.
- **Plans are enforced in the database.** On the hosted edition, `has_write_access()` and row-level security decide who can write; the UI only reflects that. Never let the client write `entitlements` or `instance_config`. See [docs/editions.md](./docs/editions.md).

### Database changes

- Add a new, numbered file in `supabase/migrations/` (the next one is `015_…`).
- Keep migrations additive and backward compatible: new nullable or defaulted columns, and new functions. Self-hosted databases upgrade by applying new files in order.
- The companion projects read the same database, so say so in the pull request if a change could affect either one:
  - [Cheque Watch](https://github.com/vikashpatel04/cheque-watch#compatibility) reads specific columns of `cheques` and `parties`
  - [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) reads and writes `cheques`, `parties`, `cheque_history` and `daily_deposits`
- Keep row-level security on for every table, and don't hardcode project URLs or keys in migrations.
- Grant privileges explicitly for every new table or view. Projects may have Supabase's "automatically expose new tables" turned off, and the tests run that way (see `013_explicit_grants.sql`).
- If you change security rules or SQL functions, add a case to `tests/migrations.test.ts`. It applies every migration to an in-memory Postgres and checks behaviour as signed-in users.

## Secrets and personal data

Never commit `.env` files, API keys, or screenshots and exports that contain real cheque, party or bank data. `.env.local` is git-ignored; keep your keys there.

## License

By contributing, you agree that your contributions are licensed under the [GNU Affero General Public License v3.0](./LICENSE), and you certify the [DCO](https://developercertificate.org/) with your sign-off.

Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).
