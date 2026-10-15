-- Daily appointment reminder via pg_cron + pg_net.
-- Calls the notify-appointments edge function every day at 13:00 UTC (8 AM Eastern).
-- Requires pg_cron and pg_net extensions (enable via Dashboard → Database → Extensions if needed).
-- Before applying: replace <YOUR_PROJECT_REF> in the URL below with your Supabase project ref.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'daily-appointment-reminder',
  '0 13 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-appointments',
      body    := '{}',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
