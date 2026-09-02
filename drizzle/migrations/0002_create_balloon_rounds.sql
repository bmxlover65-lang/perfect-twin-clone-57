CREATE TABLE public.balloon_rounds (
  round_id text PRIMARY KEY,
  event_id text NOT NULL DEFAULT '88.0023',
  crash numeric,
  crashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX balloon_rounds_created_idx ON public.balloon_rounds (created_at DESC);

GRANT SELECT ON public.balloon_rounds TO anon;
GRANT SELECT ON public.balloon_rounds TO authenticated;
GRANT ALL ON public.balloon_rounds TO service_role;

ALTER TABLE public.balloon_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Balloon rounds are public read"
ON public.balloon_rounds FOR SELECT
TO anon, authenticated
USING (true);