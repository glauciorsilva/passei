-- Importa as questões reais de data.js (repositório público) para public.questoes.
-- Usa a extensão http do Postgres; idempotente (on conflict do nothing).
create extension if not exists http with schema extensions;

with arquivo as (
  select content as txt
  from extensions.http_get('https://raw.githubusercontent.com/glauciorsilva/passei/main/data.js')
),
arr as (
  select substring(txt from position('[' in txt) for length(txt) - position('[' in txt) - position(']' in reverse(txt)) + 2)::jsonb as j
  from arquivo
)
insert into public.questoes (id, materia, assunto, enunciado, alternativas, correta_index, regra, fonte, fonte_url, valido, origem)
select (q->>'id')::bigint, q->>'materia', q->>'assunto', q->>'enunciado', q->'alternativas',
       (q->>'corretaIndex')::smallint, q->>'regra', q->>'fonte', nullif(q->>'fonteUrl',''),
       coalesce((q->>'valido')::boolean, true), 'real'
from arr, jsonb_array_elements(arr.j) as q
where q->>'corretaIndex' is not null            -- 5 questões sem gabarito (já inválidas) ficam de fora
on conflict (id) do nothing;

select origem, count(*) from public.questoes group by origem;
