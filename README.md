# conversational-looker-dashboard

Monorepo Nx + pnpm para uma webapp conversacional que controla filtros de um relatorio do Looker Studio via iframe.

## Stack
- `apps/web`: React + Vite + TypeScript
- `apps/api`: Fastify + TypeScript
- `libs/contracts`: schemas Zod compartilhados
- `libs/url-builder`: geracao deterministica da URL do Looker Studio
- `libs/ui`: componentes reaproveitaveis

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
- `pnpm lint`: `nx run-many -t lint -p web api contracts url-builder ui`
- `pnpm test`: `nx run-many -t test -p web api contracts url-builder ui`

## Testes
- `libs/url-builder` possui testes Vitest garantindo montagem deterministica da URL.

## Notas
- O builder atual monta `?filters=cidade:...;ano:...;mes:...;indicador:...`. Ajuste o formato para o padrao real do Looker Studio do seu relatorio se necessario.
