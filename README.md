# Passei — Simulados Transpetro / Cesgranrio (Administração e Controle)

Site estático com banco de **465 questões reais** (meta: ampliar até 1000), genuinamente aplicadas pela banca **Cesgranrio** em concursos anteriores (Petrobras, Transpetro, BR Distribuidora, Liquigás, BNDES, Banco do Brasil, IPEA, AgeRio, Eletrobras, BANESE, Caixa, IBGE, UNIRIO, UNEMAT, Banrisul, Eletronuclear, CNU, entre outros), cobrindo as 10 matérias do edital (Conhecimentos Gerais + Específicos):

- Português
- Matemática e Raciocínio Lógico
- Administração de RH / Processos Administrativos
- Gestão de Sistemas Integrados
- Controle Patrimonial
- Matemática Financeira
- Contabilidade
- Logística e Cadeia de Suprimentos
- Legislação (Lei 13.303/2016 e Lei 14.133/2021)
- Informática

Cada questão traz o gabarito oficial, uma explicação da regra/base teórica e a fonte (concurso, cargo, ano) — algumas trazem também o link da questão original.

## Questões inéditas (rotina diária)
Além das questões reais (`data.js`), o arquivo `data_ia.js` recebe todo dia as questões **inéditas no estilo Cesgranrio** criadas pela rotina "Simulados Transpetro" (Claude, 9h de Brasília). Elas têm `"origem": "ia"`, ids a partir de 10001, aparecem com o selo **Inédita** e podem ser filtradas na tela inicial (Todas / Reais / Inéditas). A rotina faz commit na `main` e a Vercel republica automaticamente — não edite `data_ia.js` à mão.

## Funcionalidades
- Login simples (usuário/senha) para acesso pessoal.
- Simulados por matéria ou "geral" (mesclado, sorteado).
- Cronômetro, feedback imediato (certo/errado + regra) após cada resposta.
- Dashboard de desempenho por matéria, com histórico acumulado salvo no navegador (localStorage).
- Exportar/Importar progresso em JSON, para levar o histórico entre dispositivos/navegadores.

## Stack
Site 100% estático (HTML + CSS + JS puro, sem build), pronto para deploy na Vercel.

## Rodando localmente
Basta abrir `index.html` num navegador, ou servir a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Banco de dados (Supabase)
Questões, login e histórico ficam no Supabase (projeto `fizyxtirjryozlldxxky`):
- `supabase/001_schema.sql` — tabelas `questoes`, `tentativas`, `respostas` e regras RLS (questões só para usuários logados; histórico só do próprio usuário).
- `supabase/002_importar_reais.sql` — importa as questões reais de `data.js` direto do GitHub.
- A rotina diária grava as questões inéditas direto na tabela `questoes` (`origem = 'ia'`, ids a partir de 10001).
- `config.js` guarda a URL e a chave *publishable* (pública por natureza; a proteção vem do RLS).
- O login usa Supabase Auth (e-mail e senha). O histórico antigo salvo no navegador é enviado para a conta automaticamente no primeiro login.

`data.js` e `data_ia.js` ficam no repositório como fonte/backup, mas o site não os carrega mais.
