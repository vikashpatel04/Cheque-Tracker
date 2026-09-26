## What this changes

<!-- A short description, and the issue it fixes: "Fixes #123" -->

## Screenshots

<!-- For UI changes: before and after, ideally at desktop and phone widths. Use test data only. -->

## Checklist

- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Tried it in the browser, including at phone width
- [ ] Nothing country-specific is hardcoded: amounts, dates and "today" use the region helpers ([docs/regions.md](../docs/regions.md))
- [ ] Database changes are in a new numbered migration, are additive, and don't break existing data, [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) or [Cheque Watch](https://github.com/vikashpatel04/cheque-watch)
- [ ] If security rules or SQL functions changed, `tests/migrations.test.ts` covers it
- [ ] If status rules changed, `VALID_STATUS_TRANSITIONS` and the SQL functions still match
- [ ] README or other docs updated if behaviour changed
- [ ] Commits are signed off (`git commit -s`, see CONTRIBUTING.md)
- [ ] No keys, `.env` files or real cheque data included
