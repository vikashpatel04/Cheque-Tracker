# Cheque Tracker

Personal cheque management for a retail clothing shop.

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add environment variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase publishable/anon key
4. Deploy — Vercel auto-detects Vite and uses `vercel.json` for SPA routing

All routes (`/cheques`, `/parties`, `/reports`, etc.) work via client-side routing with the rewrite rule in `vercel.json`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
