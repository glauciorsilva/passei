-- Passei: esquema do banco (Supabase / Postgres)

-- Questões: reais (ids 1..9999, importadas de data.js) e inéditas da rotina diária (ids >= 10001)
create sequence if not exists public.questoes_ia_id_seq start 10001;

create table if not exists public.questoes (
  id            bigint primary key default nextval('public.questoes_ia_id_seq'),
  materia       text not null,
  assunto       text,
  enunciado     text not null,
  alternativas  jsonb not null check (jsonb_typeof(alternativas) = 'array' and jsonb_array_length(alternativas) = 5),
  correta_index smallint not null check (correta_index between 0 and 4),
  regra         text,
  fonte         text,
  fonte_url     text,
  valido        boolean not null default true,
  origem        text not null default 'ia' check (origem in ('real','ia')),
  rodada        int,
  data_criacao  date,
  id_origem     text unique,          -- "<matéria>|R<rodada>|Q<n>" para as inéditas
  created_at    timestamptz not null default now()
);
alter sequence public.questoes_ia_id_seq owned by public.questoes.id;
create index if not exists questoes_materia_idx on public.questoes (materia) where valido;
create index if not exists questoes_origem_idx on public.questoes (origem) where valido;

-- Simulados feitos (um por tentativa)
create table if not exists public.tentativas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  feito_em        timestamptz not null default now(),
  materia         text not null,
  filtro_origem   text not null default 'todas',
  total           int not null,
  acertos         int not null,
  tempo_segundos  int not null,
  by_subj         jsonb not null default '{}'::jsonb
);
create index if not exists tentativas_user_idx on public.tentativas (user_id, feito_em desc);

-- Cada resposta (permite "revisar erros" e estatística por assunto)
create table if not exists public.respostas (
  id            bigint generated always as identity primary key,
  tentativa_id  uuid not null references public.tentativas(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id    bigint not null references public.questoes(id) on delete cascade,
  alternativa   smallint not null check (alternativa between 0 and 4),
  correta       boolean not null,
  respondida_em timestamptz not null default now()
);
create index if not exists respostas_user_questao_idx on public.respostas (user_id, questao_id);

-- Segurança (RLS): questões só leitura para quem está logado; histórico só do próprio usuário.
-- A rotina diária grava questões pelo conector (papel de serviço), que ignora RLS.
alter table public.questoes   enable row level security;
alter table public.tentativas enable row level security;
alter table public.respostas  enable row level security;

drop policy if exists "questoes: leitura autenticada" on public.questoes;
create policy "questoes: leitura autenticada" on public.questoes
  for select to authenticated using (true);

drop policy if exists "tentativas: do próprio usuário" on public.tentativas;
create policy "tentativas: do próprio usuário" on public.tentativas
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "respostas: do próprio usuário" on public.respostas;
create policy "respostas: do próprio usuário" on public.respostas
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
