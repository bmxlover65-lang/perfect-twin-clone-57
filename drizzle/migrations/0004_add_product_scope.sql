ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS products text[] NOT NULL DEFAULT ARRAY['casino','sports']::text[];

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS products text[] NOT NULL DEFAULT ARRAY['casino','sports']::text[];