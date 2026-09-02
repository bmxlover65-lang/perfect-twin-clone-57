CREATE TABLE public.bet_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES public.operators(id) ON DELETE CASCADE,
  operator_user_id text,
  game_id text,
  round_id text,
  market text,
  selection text,
  odds numeric,
  stake numeric,
  code text NOT NULL,
  message text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bet_rejections TO authenticated;
GRANT ALL ON public.bet_rejections TO service_role;

ALTER TABLE public.bet_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all rejections" ON public.bet_rejections
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "operator reads own rejections" ON public.bet_rejections
  FOR SELECT TO authenticated USING (owns_operator(operator_id));

CREATE INDEX bet_rejections_operator_created_idx ON public.bet_rejections (operator_id, created_at DESC);