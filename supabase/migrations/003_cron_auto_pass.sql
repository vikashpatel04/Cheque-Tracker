-- Enable the extensions the auto-pass job needs.
--
-- The job itself is NOT scheduled here: it calls your own project's
-- auto-pass Edge Function, so it needs your project URL and key. After
-- deploying the function, schedule it once in the SQL Editor (see
-- "Auto-pass (optional)" in README.md). Migration 008 adjusts the schedule
-- only if the job exists, so it is safe to run without it.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
