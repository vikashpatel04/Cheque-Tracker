# Cheque Tracker

A React + Supabase web app for managing post-dated cheques — track due dates, parties, deposit logs, and status history from a clean dashboard.

> **AI / MCP layer:** [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) connects an AI agent (Claude, OpenClaw, etc.) to the same Supabase database so you can query and update cheques in natural language.

---

## Features

- **Dashboard** — overview of pending, deposited, overdue, and passed cheques with totals
- **Cheques** — add, filter, and update cheque status with full transition validation
- **Parties** — manage the parties (businesses/individuals) associated with cheques
- **Returns** — dedicated view for returned/bounced cheques
- **Reports** — export data and view deposit summaries
- **Calendar** — visualise due dates across a monthly calendar
- **PDF / Excel export** — generate reports via jsPDF and xlsx

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix) |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Table | TanStack Table |
| Backend | Supabase (Postgres + Auth + RLS) |
| Build | Vite + TypeScript |
| Deploy | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project

### Setup

```bash
# 1. Clone
git clone https://github.com/vikashpatel04/Cheque-Tracker.git
cd Cheque-Tracker

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Apply the database schema
# Open your Supabase project → SQL Editor and run supabase/schema.sql

# 5. Start dev server
npm run dev
```

### Build

```bash
npm run build
```

---

## Project Structure

```
src/
  pages/          — Dashboard, Cheques, Parties, Reports, Returned, Settings
  components/     — Shared UI components
  hooks/          — Custom React hooks
  lib/            — Supabase client, utilities
  types/          — TypeScript types
supabase/         — Database schema and migrations
```

---

## Related

- [cheque-mcp](https://github.com/vikashpatel04/cheque-mcp) — MCP server that exposes this app's data to AI agents

---

## License

MIT — see [LICENSE](./LICENSE)
