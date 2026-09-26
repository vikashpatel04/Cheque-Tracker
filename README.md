# Cheque Tracker

[![CI](https://github.com/vikashpatel04/Cheque-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/vikashpatel04/Cheque-Tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

A web app for shops that pay their suppliers with post-dated cheques. Every morning it answers one question: **how much money has to be in the bank today?** It also keeps track of every cheque you've written, the parties you owe, the money you add to the bank, and anything that bounces.

Built with React and Supabase. Two companion projects run on the same database:

| Project | What it is |
|---|---|
| **Cheque Tracker** (this repo) | The web app: dashboard, cheques, parties, deposits, returns, reports and settings. Installable as a PWA. |
| [**cheque-mcp**](https://github.com/vikashpatel04/cheque-mcp) | An MCP server that lets AI assistants (Claude Desktop, OpenClaw and other MCP clients) query and update your cheques in plain English. |
| [**Cheque Watch**](https://github.com/vikashpatel04/cheque-watch) | A read-only Wear OS app and tile that shows today's cheques and the amount needed, on your wrist. |

**Contents:** [Features](#features) · [Cheque life cycle](#cheque-life-cycle) · [Companion projects](#companion-projects) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Contributing](#contributing) · [Support](#support) · [Security](#security) · [License](#license)

---

## Features

### Dashboard
- **Cash needed today:** the total of today's *Pending* cheques plus any overdue *Pending* ones. *Deposited* cheques are already covered, so they're listed but not counted. Today's cheques and overdue cheques are listed underneath, and overdue items are tagged *Overdue* or *Overdue · Deposited*.
- **Next 7 days:** a strip of the coming week with each day's cheque count, total, and a pending/deposited split bar. Tap a day to see its cheques, and step through days from that view.
- **Summary cards:** Total Outstanding, Due This Week (Mon–Sun), Overdue and Returned.
- **Monthly calendar:** month and agenda views of every due date.
- **Charts:** 30-day liability forecast, cumulative liability curve, status breakdown, 6-month cash-flow trend (cleared cheques are charted by the date they passed), and top outstanding by party.
- **Recent activity:** the latest status changes, with readable labels.

### Cheques
- Add, edit and delete cheques with party, bank, cheque number, amount, issue date and due date.
- Search by cheque number or party. Filter by one or more statuses, by party and by bank. Sort by due date, issue date, amount or party.
- **Status actions:** *Pending → Deposited → Passed*, plus *Returned* (a reason is required) and *Cancelled*. A **Deposited & Passed** shortcut records both steps in the history.
- **Duplicate warning:** the form warns when a cheque number is already in use. It's only advisory, because a re-presented cheque keeps its number.
- **Bulk entry:** a multi-row **Bulk Add** page (also available per party), plus **Excel upload** with a downloadable template.
- **Export** the filtered list to **PDF** or **Excel**.
- Every change is stored in an append-only history, shown on each cheque's detail view.

### Funds and allocation
- **Add funds to bank** from the header: enter the amount added to the bank today.
- The app suggests which pending cheques that amount covers, in the sort order you choose in Settings (oldest due first by default, or by amount). You can tick or untick any row before you confirm.
- Confirming logs the deposit and marks the ticked cheques *Deposited* in a single database transaction, so either everything is saved or nothing is.

### Returned cheques
The shop is the one writing the cheques, so a returned cheque is one of yours that bounced. Each one needs a decision:
- **Re-present:** the party deposits the same cheque again. It goes back to *Pending* (or straight to *Deposited*) with a new expected date. The printed date is kept, and the app warns if the new date is more than 3 months after the cheque date, because banks can refuse stale cheques.
- **Write off:** close a cheque that can't be used again (wrong amount, a mistake in the words, overwriting and so on) with a reason. **Issue new cheque** then opens the form pre-filled, and the new cheque is linked to the old one as its replacement.

Re-presented and replacement cheques are tagged in lists.

### Undo
- **Roll back** the latest status change on any cheque. The previous values are restored and the undo is recorded as a new history entry, so nothing is lost.

### Parties
- Keep a list of the businesses and people you issue cheques to, with contact person, phone, bank and notes.
- Search; sort by name, number of active cheques or outstanding amount; and filter to parties with active cheques.
- Each party has a detail view with its cheques and its own bulk-add page.
- Bulk-upload parties from Excel with a template.

### Reports
Pick a date range, then choose a tab:

| Tab | What it shows |
|---|---|
| Daily Cash Flow | 28-day cash flow and a day-by-day breakdown |
| Monthly | Monthly comparison, amount still to pay, and a monthly data table |
| Party-wise | Top parties with a stacked status breakdown |
| Bank-wise | Outflow by bank and bank rankings |
| Deposits | Funds added vs cheque payments, and the trend of funds added |
| Status | Status by amount and by count |

### Settings
- **Auto-pass:** optionally mark *Deposited* cheques as *Passed* automatically once their due date arrives, after a time of day you choose (IST). *Pending* cheques are never passed automatically, and due dates are never changed.
- **Allocation sort order** for the funds suggestion.
- **Currency symbol**, and the **bank list** used in forms.
- **Export all data** to one Excel workbook (parties, cheques, history and deposits).
- **Danger zone:** soft-delete all parties and cheques. You have to type `DELETE MY DATA` to confirm.

### Everywhere
- Indian number formatting (₹1,25,000.00) and dates shown and entered as DD/MM/YYYY.
- Responsive layout with a slide-in menu and drawers on phones.
- Installable as a PWA (web manifest and service worker).
- Sign-in with email and password (Supabase Auth). Row-level security keeps each user's data separate.

---

## Cheque life cycle

```
PENDING   ──► DEPOSITED ──► PASSED
PENDING   ──► RETURNED | CANCELLED
DEPOSITED ──► RETURNED | CANCELLED
RETURNED  ──► re-present ──► PENDING or DEPOSITED   (same cheque, new date)
RETURNED  ──► write off  ──► WRITTEN_OFF            (a replacement can be issued)
```

- PASSED, CANCELLED and WRITTEN_OFF are final.
- Any change can be rolled back one step at a time.
- Every transition is checked and applied inside the database (`change_cheque_status`, `represent_cheque`, `write_off_cheque`, `rollback_cheque_status`), and each one writes a history row.

---

## Companion projects

### cheque-mcp: talk to your cheques

[cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) is a [Model Context Protocol](https://modelcontextprotocol.io) server. It connects Claude Desktop, OpenClaw or any other MCP client to this app's Supabase database, so you can ask things like:

- *"Which cheques are due in the next 3 days?"*
- *"Show me all overdue cheques and the total amount at risk."*
- *"Mark cheque 004521 as returned, it bounced."*

| Tool | What it does |
|---|---|
| `get_due_cheques` | Pending and deposited cheques due in the next N days |
| `get_overdue_cheques` | Pending cheques past their due date, with the total |
| `get_all_cheques` | Cheques filtered by status or party name |
| `get_cheque_summary` | Counts and totals by status, overdue, due today and due this week |
| `add_cheque` | Add a cheque for an existing party |
| `update_cheque_status` | Change a status (with the same transition rules) and log it to history |
| `get_parties` | List and search active parties |
| `get_daily_deposits` | The deposit log for a date range |

**Setup in short:**
1. Clone the repo, run `npm install` and `npm run build`. It needs Node.js 20+.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SHOP_USER_ID`, the auth user id whose cheques it should see.
3. Add `dist/index.js` to your MCP client's config.

It runs locally over stdio. Because it uses the service-role key, it filters every query by `SHOP_USER_ID`. See the [cheque-mcp README](https://github.com/vikashpatel04/cheque-mcp#readme) for the full guide.

### Cheque Watch: today's cheques on Wear OS

[Cheque Watch](https://github.com/vikashpatel04/cheque-watch) is a small, **read-only** Wear OS companion:

- **Tile:** amount needed today, number of cheques, overdue count and amount, and the time of the last update.
- **App:** today's list with party, amount and status, and a view-only detail screen.
- **Same rules as the web app:** only *Pending* cheques count toward the amount needed. The tile shows today's amount, with overdue cheques as a separate figure.
- **Easy on battery:** it fetches about once an hour and just after midnight IST. The tile only reads the local cache.
- **No Play Store and no phone app:** it's sideloaded over ADB. It's built on a Galaxy Watch4 Classic and should work on any Wear OS 3+ watch.

**How it connects:**

```
Watch ──GET + x-watch-key──► Supabase Edge Function "watch-today" ──read-only SELECT──► this app's database
```

The `watch-today` function is deployed into **this app's** Supabase project. It runs two fixed queries inside a read-only transaction and never writes. It reads the `original_due_date` and `represent_count` columns, so apply this repo's migrations up to `009_represent_writeoff_rollback.sql` first.

**Setup in short:**
1. Clone the repo.
2. Run `.\setup.cmd` on Windows or `bash setup.sh` on macOS/Linux. The script deploys the function, generates the watch key, builds the APK and installs it on the watch over wireless ADB.

It needs Android Studio (for the SDK and JDK) and Node.js. See the [Cheque Watch README](https://github.com/vikashpatel04/cheque-watch#readme) for details.

### How it fits together

```
                ┌────────────────────────────────────────────┐
 Web app  ──────►  Supabase                                  │
 (Vercel, PWA)  │   Postgres + Auth + RLS                    │
                │   RPC: change_cheque_status, record_deposit│
 cheque-mcp ────►        represent_cheque, write_off_cheque, │
 (local, stdio) │        rollback_cheque_status              │
                │   Edge Functions: auto-pass (pg_cron),     │
 Cheque Watch ──►                   watch-today (read-only)  │
 (Wear OS)      └────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, Sonner toasts |
| Routing and forms | React Router v7, React Hook Form + Zod |
| Dates and calendar | date-fns, react-day-picker, react-big-calendar |
| Charts and tables | Recharts, TanStack Table |
| Export and import | jsPDF + jspdf-autotable, SheetJS (xlsx) |
| Backend | Supabase: Postgres, Auth, row-level security, SQL functions, Edge Functions, pg_cron |
| Build and deploy | Vite, TypeScript, Vercel |

---

## Getting started

### Prerequisites
- Node.js 20+
- A Supabase project

### 1. Install

```bash
git clone https://github.com/vikashpatel04/Cheque-Tracker.git
cd Cheque-Tracker
npm install
cp .env.example .env.local   # then fill in the two values below
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → publishable (or legacy anon) key |

### 2. Set up the database

Apply the migrations in `supabase/migrations/` in order. Either run `npx supabase link` and then `npx supabase db push`, or run each file in the SQL Editor. They create the tables, row-level security and SQL functions, and enable `pg_cron` and `pg_net` for auto-pass.

### 3. Create your login

There's no sign-up screen. Add a user under Supabase → **Authentication → Users**, then sign in with that email and password. On a hosted project, also turn off public sign-ups (see [SECURITY.md](./SECURITY.md#if-you-run-your-own-copy)).

### 4. Auto-pass (optional)

You only need this if you'll turn on **Auto-pass deposited cheques** in Settings.

1. Deploy the function:
   ```bash
   npx supabase functions deploy auto-pass --project-ref <your-project-ref>
   ```
2. Schedule it in the SQL Editor, replacing the two placeholders:
   ```sql
   select cron.schedule(
     'auto-pass-cheques',
     '*/15 * * * *',
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/auto-pass',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <your-publishable-or-anon-key>'
       ),
       body := jsonb_build_object('scheduled', true)
     );
     $$
   );
   ```

The job runs every 15 minutes. Each time, the function checks every user's auto-pass time against the current time in IST. To stop it, run `select cron.unschedule('auto-pass-cheques');`.

### 5. Run

```bash
npm run dev       # dev server (also exposed on your LAN)
npm run build     # type-check and build
npm run preview   # preview the build
npm run lint
```

### Deploy

The app deploys to Vercel as a static Vite build. `vercel.json` handles SPA routing and cache headers. See [DEPLOY.md](./DEPLOY.md).

---

## Project structure

```
src/
  pages/            Dashboard, Cheques, BulkAdd, Parties, Returned, Reports, Settings, Login
  components/
    cheques/        list, form, detail, status actions, re-present, write-off, rollback, Excel upload
    deposit/        "Add funds to bank" and the allocation dialog
    parties/        list, form, detail, Excel upload
    shared/         layout, today panel, 7-day strip, calendar, day dialog, status pills
    ui/             shadcn/ui components
  hooks/            data hooks (cheques, parties, deposits, settings, auth)
  lib/              Supabase client, RPC wrappers, allocation engine, formatting, exports, tags
  types/            app and database types
supabase/
  migrations/       001–009: schema, RLS, cron, settings, atomic functions, re-present/write-off/rollback
  functions/        auto-pass Edge Function
public/             icon, web manifest, service worker
.github/            CI, Dependabot, issue and pull request templates
```

---

## Contributing

Contributions are welcome: bug fixes, features and documentation. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first. It covers setup, the checks to run, commit style, and how to keep database changes compatible with the companion projects.

Good first steps:
- Look for open [issues](https://github.com/vikashpatel04/Cheque-Tracker/issues).
- Open an issue before starting anything large, so we can agree on the approach first.

Everyone taking part is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Support

- **Found a bug or have an idea?** Open an [issue](https://github.com/vikashpatel04/Cheque-Tracker/issues/new/choose); the templates will guide you. Please leave real cheque, party and bank details out of screenshots.
- **MCP server or watch app?** Use the issue trackers of [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp/issues) or [Cheque Watch](https://github.com/vikashpatel04/cheque-watch/issues).
- **Find it useful?** A ⭐ on the repo helps other people find it.

## Security

Please report vulnerabilities privately through [GitHub's security advisories](https://github.com/vikashpatel04/Cheque-Tracker/security/advisories/new), not in public issues. [SECURITY.md](./SECURITY.md) explains how data is protected and what to check when you host your own copy.

## Acknowledgements

Built on [Supabase](https://supabase.com), [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), [Tailwind CSS](https://tailwindcss.com), [Recharts](https://recharts.org), [react-big-calendar](https://github.com/jquense/react-big-calendar), [date-fns](https://date-fns.org), [SheetJS](https://sheetjs.com) and [jsPDF](https://github.com/parallax/jsPDF).

## License

[MIT](./LICENSE) © 2026 Vikash Patel
