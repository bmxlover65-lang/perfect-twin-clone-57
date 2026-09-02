ALTER TABLE public.ip_whitelist ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE;
ALTER TABLE public.domain_whitelist ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ip_whitelist_key_idx ON public.ip_whitelist(api_key_id);
CREATE INDEX IF NOT EXISTS domain_whitelist_key_idx ON public.domain_whitelist(api_key_id);