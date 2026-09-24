CREATE TABLE public.sports_watch (
  event_id text PRIMARY KEY,
  sport_id text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  gone_since timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sports_watch TO service_role;
ALTER TABLE public.sports_watch ENABLE ROW LEVEL SECURITY;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;