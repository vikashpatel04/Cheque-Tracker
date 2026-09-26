## What this changes

<!-- A short description, and the issue it fixes: "Fixes #123" -->

## Screenshots

<!-- For UI changes: before and after, ideally at desktop and phone widths. Use test data only. -->

## Checklist

- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` passes
- [ ] Tried it in the browser, including at phone width
- [ ] Database changes are in a new numbered migration and are additive (no breaking changes for existing data, [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) or [Cheque Watch](https://github.com/vikashpatel04/cheque-watch))
- [ ] If status rules changed, `VALID_STATUS_TRANSITIONS` and the SQL functions still match
- [ ] README or other docs updated if behaviour changed
- [ ] No keys, `.env` files or real cheque data included
