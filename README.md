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
ollama pull llama3.2:8b
```

3. Configurar variaveis de ambiente
- `apps/web/.env` (base do embed do Looker Studio)
- `apps/api/.env` (endpoint do Ollama)

Arquivos de exemplo:
- `apps/web/.env.example`
- `apps/api/.env.example`

4. Rodar em dev
```
pnpm dev
```

Isso sobe:
- Web: http://localhost:3000
- API: http://localhost:3001

## Endpoints
Implementação da rota HTTP da API: `apps/api/src/rotas.ts`.

### POST /mensagem
Request body:
```json
{
  "message": "Quero visitas em Sao Paulo em 2024",
  "ctx": {
    "dashboardId": "turismo-main",
    "currentFilters": {
      "municipio": "Rio de Janeiro",
      "classificacao": "hospedagem"
    }
  }
}
```

Response body (exemplo):
```json
{
  "action": {
    "type": "apply_filters",
    "filters": {
      "municipio": "Sao Paulo",
      "classificacao": "hospedagem"
    },
    "target": "dashboard"
  }
}
```

Response body (fallback):
```json
{
  "action": {
    "type": "explain_only",
    "message": "Nao consegui identificar um recorte analitico claro para aplicar no dashboard.",
    "suggestions": [
      "Comparar estabelecimentos entre municipios",
      "Visualizar a quantidade de funcionarios por municipio",
      "Acompanhar a evolucao de funcionarios ao longo do tempo"
    ]
  }
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
- O contrato HTTP de `POST /mensagem` fica em `libs/contracts` e é exportado por `@conversational/contracts`.
- Objetivo: permitir publicar e reutilizar os tipos/schemas de integração da API em outros projetos.
