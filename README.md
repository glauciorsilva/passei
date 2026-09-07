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

## Observação sobre autenticação
O login é uma barreira simples no lado do cliente (não é um sistema de autenticação seguro) — adequado para uso pessoal de estudo, não para proteger dados sensíveis.
