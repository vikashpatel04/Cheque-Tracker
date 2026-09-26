-- Run the auto-pass job every 15 minutes instead of once a day.
--
-- The edge function now compares each user's auto_pass_time against the
-- current IST time, so it has to run throughout the day for that setting to
-- take effect. (The old '59 23 * * *' schedule is 23:59 UTC = 05:29 IST.)
--
-- Only the schedule changes; the job's command (URL + key) is left as is.
-- Skips silently where the job doesn't exist (e.g. local development).

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'auto-pass-cheques';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_job_id, schedule := '*/15 * * * *');
  END IF;
END;
$$;
