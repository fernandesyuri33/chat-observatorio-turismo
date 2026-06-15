# Interface Conversacional para Dashboard de Turismo

Monorepo com pnpm workspaces para uma webapp conversacional que interpreta mensagens em linguagem natural e retorna uma ação estruturada para controlar um dashboard (Looker Studio).

Este README é um guia geral de onboarding rápido. A documentação de aprofundamento fica na pasta docs.

## Visão rápida

- apps/web: interface React + Vite.
- apps/api: API Fastify que recebe mensagem e devolve action.
- libs/domain: schemas e tipos de domínio.
- libs/contracts: contrato HTTP compartilhado de integração.
- libs/application, libs/policy, libs/llm, libs/providers: pipeline de decisão e adaptadores.

## Requisitos locais

- Node.js 20+
- pnpm 9+
- Redis 7+
- Ollama local ou via Docker Compose
- Docker + Docker Compose (recomendado)

## Quickstart

1. Instale dependências:

```bash
pnpm i
```

2. Configure ambiente na raiz do monorepo:

- .env.example -> .env

Variáveis importantes na API:

```env
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=ministral-3:3b-instruct-2512-q4_K_M
```

3. Suba dependências locais (Redis e Ollama) usando uma das opções abaixo:

Opção A: sem Docker (serviços instalados localmente)

- inicie Redis e Ollama no host;
- faça o pull do modelo manualmente:

```bash
ollama pull ministral-3:3b-instruct-2512-q4_K_M
```

Opção B: com Docker Compose

- para subir Redis + Ollama apenas:

```bash
docker compose up redis ollama ollama-init
```

4. Rode web + api em modo desenvolvimento:

```bash
pnpm dev
```

Ambiente esperado:

- Web: http://localhost:3000
- API: http://localhost:3001

## Opção rápida com Compose completo

Para subir tudo por container (web, api, redis, ollama):

```bash
docker compose up --build
```

Nesse fluxo completo, o `ollama-init` executa automaticamente e faz o pull do modelo configurado em `OLLAMA_MODEL`.

Para detalhes de operação com Docker/Ollama (GPU, logs e troubleshooting), veja: docs/operacao-docker-ollama.md.

## Como a API responde (alto nível)

Fluxo resumido:

1. Recebe mensagem do usuário em POST /mensagem.
2. Classifica estado do pedido e extrai recortes/filtros.
3. Normaliza e decide a resposta.
4. Retorna sempre uma action válida (exemplo: open_url ou explain_only).

Em caso de baixa confiança ou falha de processamento, a API responde com fallback explain_only.

## Contrato HTTP principal

Endpoint:

- POST /mensagem

Request:

```json
{
  "message": "Quero visitas em Poços de Caldas em 2024"
}
```

Header opcional para contexto conversacional:

```http
x-conversation-id: <uuid>
```

Response (exemplo):

```json
{
  "action": {
    "type": "open_url",
    "url": "https://datastudio.google.com/embed/reporting/70b05460-31ac-47ad-87e0-d7201ca27609/page/p_3niel4jewd?params=%7B%22ds18.municipio%22%3A%22Sao%20Paulo%22%2C%22ds18.classificacao%22%3A%22Hospedagem%22%7D",
    "title": "Looker: Funcionários por município",
    "message": "Encontrei o recorte de funcionários por município com filtro para Poços de Caldas."
  },
  "rationale": {
    "stage1": {
      "rationale": "A mensagem pede diretamente uma visualização de dados com recorte suficiente.",
      "classification": "complete_show",
      "confidence": 0.94
    },
    "stage2": {
      "rationale": "O melhor recorte identificado foi funcionários por município com filtro de município.",
      "informationType": "funcionarios_por_municipio",
      "filters": {
        "municipio": "Poços de Caldas"
      },
      "confidence": 0.91
    }
  }
}
```

Implementação da rota: apps/api/src/rotas.ts.
Contrato compartilhado: libs/contracts.

## Scripts principais

- pnpm dev: sobe apps/api e apps/web em paralelo.
- pnpm build: build do workspace.
- pnpm typecheck: checagem de tipos no workspace.
- pnpm lint: lint no workspace.
- pnpm test: testes no workspace.

## Mapa de documentação (deep dive)

- Operação Docker e Ollama: docs/operacao-docker-ollama.md
- Visão de arquitetura: docs/arquitetura.md
- Visão geral da solução: docs/arquitetura/visao-geral.md
- Organização em camadas: docs/arquitetura/organizacao-em-camadas.md
- Sequência de processamento da mensagem: docs/arquitetura/sequencia-processamento-mensagem.md
- Resumo geral: docs/resumo.md

## Para contribuição

- Prefira manter este README enxuto e orientado a onboarding.
- Coloque detalhes operacionais e explicações aprofundadas na pasta docs.
- Mantenha request/response alinhados com os contratos em libs/contracts.
