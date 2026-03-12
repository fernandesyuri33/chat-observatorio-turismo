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
- Redis 7+ (para cache de historico de conversas)
- Docker + Docker Compose (recomendado para Ollama e Redis)

## Setup

1. Instalar dependencias
```
pnpm i
```

2. Rodar Redis e Ollama
Para desenvolvimento local, use Docker Compose:
```
docker compose up redis
docker compose up ollama  # ou rode Ollama localmente (veja seção abaixo)
```

Ou, para subir tudo junto (API, web, Redis, Ollama):
```
docker compose up --build
```

3. Configurar variaveis de ambiente
- `apps/web/.env` (base do embed do Looker Studio)
- `apps/api/.env` (endpoint do Ollama e Redis)

Arquivos de exemplo:
- `apps/web/.env.example`
- `apps/api/.env.example`

Variaveis obrigatorias para desenvolvimento:
```
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2:8b
```

4. Rodar em dev
```
pnpm dev
```

Isso sobe:
- Web: http://localhost:3000
- API: http://localhost:3001

## Rodando com Docker Compose

O projeto possui um `Dockerfile` por app:
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Arquivos de Compose:
- `docker-compose.yml`: compose base, compativel com CPU
- `docker-compose.gpu.yml`: override opcional para hosts com GPU NVIDIA

### Subir tudo com Docker Compose
```
docker compose up --build
```

Isso sobe:
- Web: http://localhost:3000
- API: http://localhost:3001
- Ollama API: http://localhost:11434

No `docker-compose.yml`, a API sobe com Ollama por padrao (`OllamaLlmAdapter`) e Redis para persistencia de historico de conversas.

### Usar GPU com Ollama
Para hosts com GPU NVIDIA, drivers instalados e `nvidia-container-toolkit` configurado, use o override de GPU:

```
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Se a maquina nao tiver GPU NVIDIA pronta para containers, use apenas o compose base. Assim o Ollama continua funcionando em CPU.

### Pull do modelo automatico
O compose possui um servico `ollama-init` que faz `ollama pull` automaticamente usando a mesma variavel `OLLAMA_MODEL` da API.

Com isso:
- o `ollama` sobe e fica `healthy`
- o `ollama-init` baixa o modelo e encerra com sucesso
- a API so inicia depois que esse bootstrap termina

A API usa a rede interna do Compose em `http://ollama:11434/v1`.

Por padrao, o modelo usado e `llama3.2:8b`.
Para sobrescrever sem editar o compose:

```
OLLAMA_MODEL=llama3.1:8b docker compose up --build
```

### Rodar apenas Redis com Docker (dev)
Para desenvolvimento local em modo standalone (sem API e web em containers):
```
docker compose up redis
```

Para verificar conexao:
```
redis-cli ping
```

Responde `PONG` se estiver rodando.

### Comandos uteis
```
docker compose up -d --build
docker compose up redis
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
docker compose logs -f api
docker compose logs -f web
docker compose down
```

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
