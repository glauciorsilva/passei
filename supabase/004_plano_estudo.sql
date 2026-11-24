-- Plano de estudo do Passei: blocos de 10 com trava de 90%, revisão de fixação a cada 30
-- e justificativas escritas pelo usuário para cada alternativa.

-- Estado do plano (um por usuário): trilhas, blocos atuais, questões feitas, erros e revisões.
create table if not exists public.passei_plano_estado (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  estado        jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- Justificativa por alternativa ("por que está certa / errada").
create table if not exists public.passei_justificativas (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id    bigint not null references public.questoes(id) on delete cascade,
  alternativa   smallint not null check (alternativa between 0 and 4),
  texto         text not null,
  atualizado_em timestamptz not null default now(),
  unique (user_id, questao_id, alternativa)
);
create index if not exists passei_justificativas_user_idx on public.passei_justificativas (user_id, questao_id);

alter table public.passei_plano_estado   enable row level security;
alter table public.passei_justificativas enable row level security;

grant select, insert, update, delete on table public.passei_plano_estado   to authenticated;
grant select, insert, update, delete on table public.passei_justificativas to authenticated;

drop policy if exists "passei plano: do proprio usuario" on public.passei_plano_estado;
create policy "passei plano: do proprio usuario"
  on public.passei_plano_estado for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "passei justificativas: do proprio usuario" on public.passei_justificativas;
create policy "passei justificativas: do proprio usuario"
  on public.passei_justificativas for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
