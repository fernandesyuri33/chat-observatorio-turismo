# conversational-looker-dashboard

Monorepo Nx + pnpm para uma webapp conversacional que controla filtros de um relatorio do Looker Studio via iframe.

## Stack
- `apps/web`: React + Vite + TypeScript
- `apps/api`: Fastify + TypeScript
- `libs/domain`: modelos de dominio (acoes e intents)
- `libs/contracts`: contratos HTTP compartilhados (request/response)
- `libs/application`, `libs/policy`, `libs/llm`, `libs/providers`: orquestracao e adaptadores

## Requisitos locais
- Node.js 20+
- pnpm 9+
- Ollama rodando localmente

## Setup
1. Instalar dependencias
```
pnpm i
```

2. Rodar o Ollama e baixar o modelo
```
ollama serve
ollama pull llama3.1:8b
```

3. Configurar variaveis de ambiente
- `apps/web/.env` (base do embed do Looker Studio)
- `apps/api/.env` (endpoint do Ollama)

Arquivos de exemplo:
- `apps/web/.env.example`
- `apps/api/.env.example`

Observacao: no frontend, use `VITE_LOOKER_EMBED_URL` (equivalente ao `LOOKER_EMBED_URL` citado no requisito, mas com o prefixo `VITE_` exigido pelo Vite).

4. Rodar em dev
```
pnpm dev
```

Isso sobe:
- Web: http://localhost:3000
- API: http://localhost:3001

## Endpoints
### POST /interpret
Request body:
```json
{
  "message": "Quero visitas em Sao Paulo em 2024",
  "currentFilters": {
    "cidade": "Rio de Janeiro",
    "ano": [2023],
    "mes": [1, 2],
    "indicador": "ocupacao"
  }
}
```

Response body (exemplo):
```json
{
  "action": {
    "type": "set_filters",
    "filters": {
      "cidade": "Sao Paulo",
      "ano": [2024],
      "indicador": "visitas"
    }
  },
  "assistantText": "Aplicando filtros: cidade Sao Paulo | ano 2024 | indicador visitas."
}
```

Response body (fallback):
```json
{
  "action": {
    "type": "unknown",
    "reason": "Nao consegui interpretar a solicitacao dentro do mundo fechado.",
    "suggestions": [
      "Quero visitas em Sao Paulo em 2024",
      "Resetar filtros",
      "Explique o indicador ocupacao"
    ]
  },
  "assistantText": "Nao consegui interpretar a solicitacao dentro do mundo fechado."
}
```

## Scripts
- `pnpm dev`: `nx run-many -t serve -p web api`
- `pnpm build`: `nx run-many -t build -p web api`
- `pnpm typecheck`: `nx run-many -t build -p web api domain contracts application policy llm providers`
- `pnpm lint`: `nx run-many -t lint -p web api domain contracts application policy llm providers`
- `pnpm test`: `nx run-many -t test -p web api domain contracts application policy llm providers`

## Testes
- `libs/domain`, `libs/contracts` e `libs/application` possuem testes Vitest para schemas e pipeline.

### Convenção de linguagem nos testes
- Títulos de `describe` e `it` devem ser escritos em português (pt-BR).
- Mensagens de erro/retorno usadas em cenários de teste devem permanecer em português quando forem user-facing.
- Identificadores técnicos (nomes de funções, tipos, chaves de payload) permanecem em inglês quando fizerem parte da API/código.

## Pacote de contratos
- O contrato HTTP de `POST /dashboard/resolve` fica em `libs/contracts` e é exportado por `@conversational/contracts`.
- Objetivo: permitir publicar e reutilizar os tipos/schemas de integração da API em outros projetos.

## Notas
- O builder atual monta `?filters=cidade:...;ano:...;mes:...;indicador:...`. Ajuste o formato para o padrao real do Looker Studio do seu relatorio se necessario.
- Retries técnicos de chamada ao LLM ficam no `OllamaLlmAdapter` (configurados por `fallback.retryCount` no bootstrap da API). O caso de uso não mantém loop de retry; em falha, aplica fallback de orientação.
