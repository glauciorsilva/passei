-- Meta semanal do Passei: checklist por usuário, com funcionamento offline no cliente.
create table if not exists public.passei_planos_semanais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  titulo text not null default 'Meta semanal de estudos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.passei_metas_semanais (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.passei_planos_semanais(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria text not null,
  titulo text not null,
  minutos_estimados integer not null check (minutos_estimados > 0),
  ordem integer not null default 0,
  concluida boolean not null default false,
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists passei_planos_semanais_user_week_idx
  on public.passei_planos_semanais (user_id, week_start desc);
create index if not exists passei_metas_semanais_user_plano_idx
  on public.passei_metas_semanais (user_id, plano_id, ordem);

alter table public.passei_planos_semanais enable row level security;
alter table public.passei_metas_semanais enable row level security;

grant select, insert, update, delete on table public.passei_planos_semanais to authenticated;
grant select, insert, update, delete on table public.passei_metas_semanais to authenticated;

drop policy if exists "passei planos: do proprio usuario" on public.passei_planos_semanais;
create policy "passei planos: do proprio usuario"
  on public.passei_planos_semanais for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "passei metas: do proprio usuario" on public.passei_metas_semanais;
create policy "passei metas: do proprio usuario"
  on public.passei_metas_semanais for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);