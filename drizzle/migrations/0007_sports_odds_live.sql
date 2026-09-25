CREATE TABLE public.sports_odds_live (
  key text PRIMARY KEY,
  at bigint NOT NULL,
  odds jsonb NOT NULL
);
GRANT ALL ON public.sports_odds_live TO service_role;
ALTER TABLE public.sports_odds_live ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.put_sports_odds(_key text, _at bigint, _odds jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.sports_odds_live(key, at, odds) VALUES (_key, _at, _odds)
  ON CONFLICT (key) DO UPDATE SET at = excluded.at, odds = excluded.odds
  WHERE public.sports_odds_live.at < excluded.at;
$$;
REVOKE ALL ON FUNCTION public.put_sports_odds(text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.put_sports_odds(text, bigint, jsonb) TO service_role;