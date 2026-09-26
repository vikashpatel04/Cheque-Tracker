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

Follow [Getting started](./README.md#getting-started) in the README. You'll need Node.js 20+ and a Supabase project of your own (the free tier is enough). Use test data, never real cheques.

## Making a change

1. Fork the repo and create a branch from `main`, for example `fix/allocation-rounding`.
2. Make your change, keeping it focused on one thing.
3. Run the same checks as CI:
   ```bash
   npm run lint    # must pass with no errors
   npm run build   # type-check + production build
   ```
4. Try it in the browser, including at phone width. Most of the app is used on phones.
5. Open a pull request and fill in the template.

### Commit messages

The history uses [Conventional Commits](https://www.conventionalcommits.org/), and new commits should follow it too:

```
feat(cheques): warn when a cheque number is already in use
fix(auto-pass): use IST and run the job throughout the day
chore(lint): fix ESLint config for ESLint 9 flat config
```

## Project conventions

- **UI:** build with the shadcn/ui components in `src/components/ui` and Tailwind. Match the existing look rather than adding new styles.
- **Money and dates:** use the helpers in `src/lib/formatters.ts`, `formatCurrency` and `formatDate`. Amounts use Indian grouping (₹1,25,000.00), dates display as DD/MM/YYYY, and "today" means India time (IST).
- **Status changes go through the database.** Use the wrappers in `src/lib/updateChequeStatus.ts`, which call SQL functions such as `change_cheque_status` and `record_deposit`, so that every change is atomic and written to history. Don't update `cheques.status` directly from the client.
- **Keep the transition rules in sync.** `VALID_STATUS_TRANSITIONS` in `src/types/index.ts` mirrors the checks in the SQL functions. If you change one, change the other.

### Database changes

- Add a new, numbered file in `supabase/migrations/` (the next one is `010_…`).
- Keep migrations additive and backward compatible: new nullable or defaulted columns, and new functions. The companion projects read the same database:
  - [Cheque Watch](https://github.com/vikashpatel04/cheque-watch#compatibility) reads specific columns of `cheques` and `parties`
  - [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) reads and writes `cheques`, `parties`, `cheque_history` and `daily_deposits`

  If a change could affect either one, say so in the pull request.
- Keep row-level security on for every table, and don't hardcode project URLs or keys in migrations.
- Update `src/types/database.ts` to match.

## Secrets and personal data

Never commit `.env` files, API keys, or screenshots and exports that contain real cheque, party or bank data. `.env.local` is git-ignored; keep your keys there.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).

Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).
