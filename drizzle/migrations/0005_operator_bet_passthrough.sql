ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS bet_passthrough boolean NOT NULL DEFAULT true;