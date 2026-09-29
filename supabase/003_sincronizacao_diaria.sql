-- Sincronização diária: o banco baixa data_ia.js do GitHub e insere as questões inéditas novas.
-- Rodar uma vez no SQL Editor do Supabase (Dashboard → SQL Editor → New query → colar → Run).
create extension if not exists pg_cron;

-- Schema privado (não exposto pela API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sync_log (
  id           bigint generated always as identity primary key,
  executado_em timestamptz not null default now(),
  inseridas    int,
  ignoradas    int,
  erro         text
);

-- Ignora itens malformados (sem gabarito, sem 5 alternativas) em vez de abortar tudo.
create or replace function private.sincronizar_questoes_ia()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_txt text;
  v_json jsonb;
  v_total int;
  v_ins int;
begin
  select content into v_txt
  from extensions.http_get('https://raw.githubusercontent.com/glauciorsilva/passei/main/data_ia.js');

  v_json := substring(v_txt from position('[' in v_txt)
             for length(v_txt) - position('[' in v_txt) - position(']' in reverse(v_txt)) + 2)::jsonb;
  v_total := jsonb_array_length(v_json);

  with validas as (
    select q from jsonb_array_elements(v_json) as q
    where jsonb_typeof(q->'alternativas') = 'array'
      and jsonb_array_length(q->'alternativas') = 5
      and (q->>'corretaIndex') ~ '^[0-4]$'
      and coalesce(q->>'enunciado','') <> ''
      and coalesce(q->>'materia','') <> ''
  ), ins as (
    insert into public.questoes (id, materia, assunto, enunciado, alternativas, correta_index, regra, fonte, fonte_url,
                                 valido, origem, rodada, data_criacao, id_origem)
    select (q->>'id')::bigint, q->>'materia', q->>'assunto', q->>'enunciado', q->'alternativas',
           (q->>'corretaIndex')::smallint, q->>'regra', q->>'fonte', nullif(q->>'fonteUrl',''),
           coalesce((q->>'valido')::boolean, true), 'ia',
           nullif(q->>'rodada','')::int, nullif(q->>'dataCriacao','')::date, q->>'idOrigem'
    from validas
    on conflict do nothing
    returning 1
  )
  select count(*) into v_ins from ins;

  perform setval('public.questoes_ia_id_seq',
                 greatest(10000, (select coalesce(max(id),10000) from public.questoes where origem = 'ia')));

  insert into private.sync_log (inseridas, ignoradas) values (v_ins, v_total - v_ins);
exception when others then
  insert into private.sync_log (inseridas, erro) values (0, sqlerrm);
end;
$$;
revoke execute on function private.sincronizar_questoes_ia() from public, anon, authenticated;

-- A rotina roda às 12:00 UTC (9h Brasília); sincroniza de hora em hora das 13h às 23h UTC (10h–20h Brasília)
select cron.schedule('sincronizar-questoes-ia', '5 13-23 * * *', $$select private.sincronizar_questoes_ia()$$);

-- Roda uma vez agora e mostra o resultado
select private.sincronizar_questoes_ia();
select * from private.sync_log order by id desc limit 5;
