-- ============ roles ============
create type public.app_role as enum ('admin', 'operator');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============ operators ============
create table public.operators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  contact_email text,
  currency text not null default 'INR',
  callback_url text,
  callback_secret text,
  status text not null default 'active',
  plan_amount numeric(12,2) not null default 0,
  plan_expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.operators to authenticated;
grant all on public.operators to service_role;
alter table public.operators enable row level security;

create policy "admins manage operators" on public.operators
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "owner reads own operator" on public.operators
  for select to authenticated using (auth.uid() = owner_id);
create policy "owner updates callback" on public.operators
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============ api keys ============
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  label text not null default 'default',
  key_prefix text not null,
  key_hash text not null unique,
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_operator_idx on public.api_keys(operator_id);
grant select, insert, update, delete on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;

create or replace function public.owns_operator(_operator_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operators o where o.id = _operator_id and o.owner_id = auth.uid())
$$;

create policy "admins manage api keys" on public.api_keys
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "operator reads own api keys" on public.api_keys
  for select to authenticated using (public.owns_operator(operator_id));

-- ============ whitelists ============
create table public.ip_whitelist (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  ip text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (operator_id, ip)
);
create table public.domain_whitelist (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  domain text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (operator_id, domain)
);
grant select, insert, update, delete on public.ip_whitelist to authenticated;
grant all on public.ip_whitelist to service_role;
grant select, insert, update, delete on public.domain_whitelist to authenticated;
grant all on public.domain_whitelist to service_role;
alter table public.ip_whitelist enable row level security;
alter table public.domain_whitelist enable row level security;

create policy "admins manage ip whitelist" on public.ip_whitelist
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "operator manages own ip whitelist" on public.ip_whitelist
  for all to authenticated
  using (public.owns_operator(operator_id)) with check (public.owns_operator(operator_id));
create policy "admins manage domain whitelist" on public.domain_whitelist
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "operator manages own domain whitelist" on public.domain_whitelist
  for all to authenticated
  using (public.owns_operator(operator_id)) with check (public.owns_operator(operator_id));

-- ============ rounds / manual results ============
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  round_id text not null,
  status text not null default 'open',
  result jsonb,
  manual boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, round_id)
);
grant select on public.rounds to authenticated;
grant insert, update, delete on public.rounds to authenticated;
grant all on public.rounds to service_role;
alter table public.rounds enable row level security;
create policy "authenticated read rounds" on public.rounds for select to authenticated using (true);
create policy "admins manage rounds" on public.rounds
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ bets ============
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  operator_user_id text not null,
  game_id text not null,
  round_id text not null,
  market text,
  selection text not null,
  odds numeric(10,2) not null,
  stake numeric(14,2) not null,
  payout numeric(14,2) not null default 0,
  status text not null default 'open',
  reference text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index bets_operator_idx on public.bets(operator_id, created_at desc);
create index bets_round_idx on public.bets(game_id, round_id);
grant select on public.bets to authenticated;
grant all on public.bets to service_role;
alter table public.bets enable row level security;
create policy "admins read all bets" on public.bets
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "operator reads own bets" on public.bets
  for select to authenticated using (public.owns_operator(operator_id));

-- ============ transactions (callback wallet ledger) ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  bet_id uuid references public.bets(id) on delete set null,
  operator_user_id text not null,
  kind text not null,
  amount numeric(14,2) not null,
  balance_after numeric(14,2),
  status text not null default 'pending',
  reference text,
  created_at timestamptz not null default now()
);
create index transactions_operator_idx on public.transactions(operator_id, created_at desc);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "admins read all transactions" on public.transactions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "operator reads own transactions" on public.transactions
  for select to authenticated using (public.owns_operator(operator_id));

-- ============ callback logs ============
create table public.callback_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  endpoint text not null,
  request jsonb,
  response jsonb,
  status_code int,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index callback_logs_operator_idx on public.callback_logs(operator_id, created_at desc);
grant select on public.callback_logs to authenticated;
grant all on public.callback_logs to service_role;
alter table public.callback_logs enable row level security;
create policy "admins read callback logs" on public.callback_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "operator reads own callback logs" on public.callback_logs
  for select to authenticated using (public.owns_operator(operator_id));