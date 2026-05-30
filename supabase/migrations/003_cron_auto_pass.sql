-- Enable extensions and schedule auto-pass edge function
-- Applied to remote project with project-specific URL and publishable key.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'auto-pass-cheques',
  '59 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hrguwcshqgsoggeldagu.supabase.co/functions/v1/auto-pass',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<YOUR_PUBLISHABLE_KEY>'
    ),
    body := jsonb_build_object('scheduled', true)
  ) AS request_id;
  $$
);
