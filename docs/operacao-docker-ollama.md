# Operação Docker e Ollama

Guia de operação para desenvolvimento e execução local usando Docker Compose.

## Objetivo

Este documento cobre:

- como subir os serviços por compose;
- como usar o override de GPU;
- como acompanhar logs;
- como reiniciar ambiente limpo;
- detalhes de conectividade do Ollama neste repositório.

## Arquivos de compose

- docker-compose.yml: fluxo base (CPU), inclui redis, ollama, ollama-init, api e web.
- docker-compose.gpu.yml: override opcional para hosts NVIDIA.

## Subir ambiente completo

```bash
docker compose up --build
```

Serviços esperados:

- web em http://localhost:3000 (ou PORT_WEB customizado);
- api em http://localhost:3001 (ou PORT_API customizado);
- redis em localhost:6379.

Observação importante:

- no compose atual, o serviço ollama não expõe porta no host;
- a API acessa o Ollama pela rede interna em http://ollama:11434/v1.

## Subir apenas dependências para dev local

Se você for rodar api/web fora de container (pnpm dev):

```bash
docker compose up redis ollama ollama-init
```

Depois, em outro terminal:

```bash
pnpm dev
```

## Usar GPU (NVIDIA)

Quando o host tiver drivers + nvidia-container-toolkit configurados:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Se não houver suporte de GPU no host, use apenas o compose base.

## Logs e diagnóstico rápido

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f ollama
docker compose ps
```

Dicas:

- `ollama-init` deve terminar com sucesso após fazer pull do modelo;
- a API depende de redis, ollama e ollama-init para subir no compose completo.

## Reiniciar ambiente limpo

```bash
docker compose down
docker compose up --build
```

Para limpar também volumes locais (inclui modelos baixados no volume do Ollama):

```bash
docker compose down -v
```

## Variáveis úteis

- OLLAMA_MODEL: modelo usado por api e ollama-init.
- PORT_API: porta publicada da API no host.
- PORT_WEB: porta publicada da web no host.
- VITE_LOOKER_EMBED_URL: URL base de embed usada no build do frontend.

Exemplo:

```bash
OLLAMA_MODEL=ministral-3:3b-instruct-2512-q4_K_M docker compose up --build
```
