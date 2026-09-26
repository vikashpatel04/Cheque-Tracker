# Received cheques

Received cheques are the cheques other people give you: customers, tenants, borrowers, clients. They have their own tables, separate from the cheques you give, so each side can grow its own fields.

> **Status:** the database side is done and tested (migration `012_received_cheques.sql`). The screens come with the redesign.

## Life cycle

```
IN_HAND   ──► DEPOSITED ──► CLEARED
IN_HAND   ──► SETTLED | HANDED_BACK | WRITTEN_OFF | REPLACED
DEPOSITED ──► BOUNCED
BOUNCED   ──► deposit again ──► DEPOSITED (now) or IN_HAND (on a new date)
BOUNCED   ──► SETTLED | WRITTEN_OFF | REPLACED
```

| Status | Shown as | Meaning |
|---|---|---|
| `IN_HAND` | In hand | You have the cheque and haven't deposited it yet |
| `DEPOSITED` | In clearing | Deposited at your bank, waiting to clear |
| `CLEARED` | Cleared | The money is in your account |
| `BOUNCED` | Bounced | Returned unpaid; needs a decision |
| `SETTLED` | Settled | The payer paid another way (cash or transfer) |
| `HANDED_BACK` | Handed back | Returned to the payer, e.g. a cancelled deal or a security cheque at the end of a lease |
| `WRITTEN_OFF` | Written off | The money won't come |
| `REPLACED` | Replaced | The payer gave a new cheque instead, linked to this one |

Cleared, settled, handed back, written off and replaced are final. Any change can be undone one step at a time.

## Actions

Every change goes through a SQL function that checks it, applies it and writes a history row, all in one transaction. The wrappers are in `src/lib/receivedCheques.ts`.

| Action | Function | From | To | Needs |
|---|---|---|---|---|
| Deposit | `deposit_received_cheques` | In hand | In clearing | Deposit date; optional account. Several cheques at once, all or nothing |
| Mark cleared | `clear_received_cheques` | In clearing | Cleared | Clearing date, not before the deposit. Several at once |
| Mark bounced | `bounce_received_cheque` | In clearing | Bounced | Date and reason; optional bank charges, which add up across bounces |
| Deposit again | `redeposit_received_cheque` | Bounced | In clearing, or In hand with a new date | Date |
| Paid another way | `settle_received_cheque` | In hand, Bounced | Settled | Method (cash, transfer, other), date, optional reference |
| Hand back | `hand_back_received_cheque` | In hand | Handed back | Optional reason |
| Write off | `write_off_received_cheque` | In hand, Bounced | Written off | Reason |
| Replace | `replace_received_cheque` | In hand, Bounced | Replaced | The new cheque's details; it's created in hand and linked |
| Undo | `rollback_received_cheque` | Any | The previous state | Nothing |

`RECEIVED_ACTIONS` in `src/types/received.ts` lists what's possible in each status. `tests/received.test.ts` tries every action in every status and fails if the list and the SQL ever disagree.

## Rules the database enforces

- **Status changes only through the actions.** A trigger refuses direct updates to the status and its dates, and new cheques always start in hand. History can only be written by the actions.
- **Your own data only.** Row-level security limits every table to the signed-in user, and the trigger checks that the party and bank account are yours; foreign keys alone don't.
- **Regular cheques** need an amount and a cheque date. **Security cheques** may leave both blank, but need them filled in before they're deposited.
- **Plans:** on the hosted edition, writes need an active plan. The actions say so clearly: "Your plan has ended". See [editions.md](./editions.md).

## Dates

| Column | Meaning |
|---|---|
| `received_on` | When you got the cheque |
| `cheque_date` | Date written on it. Validity is counted from here |
| `due_date` | When to deposit it (regular) or review it (security). Moves if a bounced cheque is to be deposited again later |
| `deposited_on`, `cleared_on`, `bounced_on`, `settled_on` | When those happened |

## What needs attention

`receivedAlerts()` in `src/lib/receivedSchedule.ts` works out, for a given day, what a cheque needs:

| Alert | When |
|---|---|
| Deposit today | In hand and due today |
| Deposit overdue | In hand and its due date has passed |
| Going stale | Within 7 days of its last valid day (cheque date + the region's validity period) |
| Stale | Past its last valid day; banks will refuse it |
| Did it clear? | Deposited longer ago than the region's usual clearing time |
| Review | A security cheque whose review date has come |
| Needs a decision | Bounced |

Validity and clearing time come from the user's region (Settings → Region), so they differ by country. See [regions.md](./regions.md).

## Series and security cheques

- **Series:** rent or EMI cheques can be added in one go. `buildSeries()` counts dates from the first cheque (weekly, monthly, quarterly or yearly) and cheque numbers up from the first number. `createReceivedSeries()` saves them all or none, with a shared `series_id`.
- **Security cheques** (`kind = 'SECURITY'`) are held rather than deposited on a date. `due_date` is when to review them, for example at the end of a lease or loan. They're usually handed back at the end, or filled in and deposited if needed.

## Bank accounts

`bank_accounts` holds your own accounts: a name, the bank, and only the last four characters of the account number. Received cheques record which account they were deposited into. Given cheques will use the same accounts later, for a per-account view of money in and out.

## Both directions together

The `all_cheques` view lists given and received cheques together with a `direction` column (`GIVEN` or `RECEIVED`), for shared screens: today, calendar and the party ledger. It's created with `security_invoker`, so row-level security applies through it. Without that, a view would show every user's rows.

## Companion projects

cheque-mcp and Cheque Watch read the `cheques` table only, so they're unaffected and don't see received cheques yet.
