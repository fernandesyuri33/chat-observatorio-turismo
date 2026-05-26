# Resumo do Projeto

## 1. O que este projeto é

Este repositório implementa um dashboard conversacional para Looker Studio. A proposta é permitir que uma pessoa descreva em linguagem natural o que quer analisar e o sistema transforme essa mensagem em uma ação estruturada, validada e segura para a interface executar.

Na prática, o fluxo principal é:

1. o usuário escreve uma mensagem no frontend;
2. a API interpreta a intenção com ajuda de um LLM;
3. a aplicação normaliza filtros e decide deterministicamente qual resposta dar;
4. um provider traduz essa decisão para uma ação concreta do dashboard;
5. o frontend aplica a ação e mostra ao usuário uma resposta amigável.

O projeto foi organizado como um monorepo Nx com `pnpm`, separando frontend, backend e bibliotecas compartilhadas por responsabilidade.

## 2. Objetivo funcional

O sistema não tenta responder qualquer pergunta aberta. Ele é orientado a transformar mensagens em interações de dashboard. Isso inclui:

- abrir uma página específica do Looker Studio;
- aplicar filtros estruturados;
- executar uma query customizada, quando um provider alternativo estiver ativo;
- orientar o usuário quando a mensagem ainda estiver vaga;
- converter perguntas exploratórias em sugestões de recorte analítico.

O foco está menos em "chat livre" e mais em "interpretação de intenção para navegação e análise".

## 3. Stack e tecnologias principais

- Monorepo: Nx
- Gerenciador de pacotes: pnpm
- Linguagem: TypeScript
- Backend HTTP: Fastify
- Frontend: React + Vite
- Validação: Zod
- LLM: Ollama via SDK compatível com OpenAI
- Histórico de conversa: Redis
- Testes: Vitest
- Execução local: Node.js e Docker Compose

## 4. Estrutura do repositório

### Apps

- `apps/api`: servidor Fastify, wiring de dependências, rota HTTP, integração com Redis.
- `apps/web`: interface React que envia mensagens, renderiza o iframe do Looker e mostra a ação retornada.

### Bibliotecas

- `libs/domain`: schemas e tipos centrais do domínio, como `DashboardAction`, estados de requisição e resultados de extração.
- `libs/contracts`: contrato HTTP compartilhado entre frontend e backend para `POST /mensagem`.
- `libs/application`: caso de uso principal e pipeline de resolução da ação.
- `libs/policy`: configuração tipada e normalização de filtros/sinônimos.
- `libs/llm`: porta do LLM, adapter stub e adapter real para Ollama.
- `libs/providers`: estratégias que transformam a intenção normalizada em ação de dashboard.

### Documentação e suporte

- `docs/arquitetura.md`: diagramas e visão arquitetural.
- `tools/clean-artifacts.mjs`: limpeza de artefatos gerados.
- `docker-compose.yml`: ambiente completo com Redis, Ollama, API e Web.
- `docker-compose.gpu.yml`: override para hosts com GPU NVIDIA.

## 5. Arquitetura em camadas

O projeto segue uma separação inspirada em arquitetura limpa e ports/adapters.

### Domain

Contém apenas modelos e schemas centrais, sem dependência de Fastify, React, Redis ou providers concretos. Aqui ficam as formas válidas de intenção, ações e respostas intermediárias.

### Contracts

Expõe o contrato HTTP público compartilhado. Isso evita drift entre backend e frontend, porque ambos usam o mesmo schema Zod para request e response.

### Application

É o núcleo de orquestração. Coordena o pipeline, chama o LLM, aplica a policy, decide a resposta e valida a ação final. A regra importante aqui é: falhas não devem vazar para a camada HTTP; o sistema sempre devolve uma ação válida.

### Policy

Centraliza configuração e normalização: confiança mínima, sinônimos, filtros permitidos, histórico, FAQ de curiosidades e configuração do provider Looker.

### LLM

Encapsula a integração com o modelo. O restante do sistema não depende do SDK diretamente, apenas da interface `LlmPort`.

### Providers

Traduzem a intenção normalizada em `DashboardAction`. O projeto registra mais de um provider, mas só um fica ativo por vez.

### Apps

`apps/api` faz o wiring e expõe a rota; `apps/web` consome a API e executa a ação na interface.

## 6. Como o sistema funciona ponta a ponta

O fluxo real atual é um pipeline em 4 etapas.

### Etapa 1: classificação do estado da requisição

O LLM classifica a mensagem do usuário em um dos estados abaixo:

- `complete_show`: o usuário já expressou um recorte analítico claro;
- `context_only`: a mensagem traz contexto, mas não uma ação analítica fechada;
- `initial_orientation`: o usuário quer saber o que pode fazer;
- `curiosity_to_action`: a mensagem é uma curiosidade que pode virar análise;
- `unclear`: a mensagem ainda está vaga demais.

Se o estado vier como `initial_orientation` ou `unclear`, o pipeline faz short-circuit e retorna orientação sem avançar para a extração.

### Etapa 2: extração estruturada

O LLM extrai:

- `candidateInformationType`: o tipo de visualização ou análise pretendida;
- `proposedFilters`: filtros sugeridos, hoje concentrados em `classificacao` e `municipio`;
- `confidence`;
- `rationale`.

Depois disso, a `PolicyEngine` normaliza os dados, resolve sinônimos e remove chaves desconhecidas.

### Etapa 3: decisão de resposta

Essa etapa é determinística. O arquivo `libs/application/src/response-router.ts` decide a resposta com base em:

- estado classificado na etapa 1;
- extração normalizada da etapa 2;
- `minConfidence`;
- FAQ configurado para casos de `curiosity_to_action`.

As decisões possíveis incluem:

- dar orientação inicial;
- dar orientação contextual;
- executar uma visualização;
- converter curiosidade em sugestão objetiva.

### Etapa 4: geração de mensagem amigável

Depois que a ação é decidida, o sistema faz uma chamada best-effort ao LLM para gerar uma mensagem mais natural para o usuário. Se essa etapa falhar, a ação continua válida e é retornada assim mesmo.

## 7. Tipos de ação retornados ao frontend

O domínio define uma união discriminada chamada `DashboardAction`, com três variantes.

### `open_url`

Usada principalmente pelo provider Looker. Contém:

- `url`;
- `title` opcional;
- `message` opcional;
- `meta` opcional.

### `run_query`

Usada pelo provider customizado. Representa a intenção de executar uma função com argumentos.

### `explain_only`

Usada quando o sistema quer orientar, sugerir ou responder sem acionar uma navegação direta.

## 8. Modelo de provider único

O sistema suporta múltiplos providers registrados, mas opera com apenas um provider ativo por vez.

Hoje o provider ativo é configurado em `apps/api/config/policy.ts` com:

```ts
activeProvider: "looker"
```

Os providers atualmente implementados são:

- `LookerProvider`: monta uma `open_url` com base na página do Looker Studio e nos filtros serializados em `params`.
- `CustomProvider`: retorna `run_query` chamando a função `tourism.resolve`.

Isso significa que o domínio e o caso de uso não precisam mudar quando a estratégia de execução mudar; basta trocar o provider ativo.

## 9. Tipos de informação suportados

O sistema trabalha com quatro recortes analíticos canônicos:

- `estabelecimentos_por_municipio`
- `funcionarios_por_municipio`
- `funcionarios_ao_longo_do_tempo`
- `saldo_funcionarios_ao_longo_do_tempo`

No provider Looker, cada um desses tipos é mapeado para uma página específica do relatório.

## 10. Filtros suportados e normalização

Atualmente os filtros estruturados reconhecidos são:

- `classificacao`
- `municipio`

As classificações canônicas aceitas hoje são:

- `alimentação`
- `transportes`
- `comércios e serviços`
- `hospedagem`
- `entretenimento`
- `agencias e operadores`

A normalização aplica sinônimos tanto em chaves quanto em valores. Depois disso, o motor de policy descarta qualquer filtro fora do conjunto permitido. Esse comportamento é estrito por padrão.

## 11. Configuração central do sistema

O principal ponto de configuração do comportamento está em `apps/api/config/policy.ts`.

No estado atual do repositório, essa configuração define:

- `minConfidence: 0.5`
- `activeProvider: "looker"`
- `fallback.retryCount: 3`
- `fallback.contextualOrientationOptionCount: 3`
- `history.maxMessages: 4`
- `history.ttlSeconds: 1800`
- FAQ de curiosidades para perguntas como evolução do turismo, empregos e estabelecimentos
- `looker.baseUrl` apontando para o relatório embedado
- `looker.paramMapByInformationType` com o mapeamento de `municipio` e `classificacao` para os parâmetros `ds19.*`, `ds17.*`, `ds18.*` e `ds20.*` de cada recorte do Looker
- `looker.paramMap` mantido como fallback global opcional para compatibilidade
- `looker.informationTypeMap` com o mapeamento de cada recorte para a página correspondente do Looker

Essa configuração é validada com Zod antes de ser usada.

## 12. Contrato HTTP da API

A API expõe principalmente a rota:

```http
POST /mensagem
```

### Request

```json
{
  "message": "Quero ver funcionarios por municipio em Poços de Caldas"
}
```

### Header opcional

```http
x-conversation-id: <uuid>
```

### Response

```json
{
  "action": {
    "type": "open_url",
    "url": "https://..."
  },
  "rationale": {
    "stage1": {
      "classification": "complete_show",
      "confidence": 0.92,
      "rationale": "..."
    },
    "stage2": {
      "informationType": "funcionarios_por_municipio",
      "filters": {
        "municipio": "Poços de Caldas"
      },
      "confidence": 0.88,
      "rationale": "..."
    }
  }
}
```

O `rationale` é opcional, mas o frontend atual sabe exibi-lo para explicar como a IA classificou e extraiu a intenção.

## 13. Histórico conversacional

O histórico de conversa é persistido em Redis pelo `HistoryService`.

Características principais:

- a chave usada é `history:{conversationId}`;
- o cliente envia um `x-conversation-id` e o frontend persiste esse identificador em `localStorage`;
- o histórico armazenado é um array de turnos com `role` e `content`;
- só os últimos `maxMessages` turnos são mantidos;
- o TTL é renovado a cada atualização.

Importante: o conteúdo persistido do lado do assistente não é a `DashboardAction` completa; é um resumo textual da intenção resolvida, usado como contexto para chamadas futuras ao LLM.

## 14. Frontend

O frontend é um SPA React simples que cumpre quatro papéis principais:

- manter o histórico visual do chat;
- enviar mensagens para a API;
- atualizar o iframe do Looker quando recebe `open_url`;
- exibir a ação retornada e o rationale das etapas do pipeline.

Configurações relevantes no frontend:

- `VITE_API_URL`: URL base da API;
- `VITE_LOOKER_EMBED_URL`: URL inicial do iframe do Looker.

O frontend usa os mesmos schemas de contrato da API para validar payloads de entrada e saída.

## 15. Backend

O backend Fastify é enxuto e funciona como camada de orquestração HTTP.

Em `apps/api/src/main.ts`, ele:

- carrega variáveis de ambiente;
- cria a instância Fastify;
- registra CORS;
- instancia `PolicyEngine`;
- escolhe o adapter de LLM;
- registra os providers conhecidos;
- seleciona o provider ativo;
- cria o cliente Redis e o `HistoryService`;
- expõe `/health`;
- registra `POST /mensagem`.

Em `apps/api/src/rotas.ts`, ele:

- valida a requisição com `PostMensagemRequestSchema`;
- carrega o histórico pelo `x-conversation-id`;
- chama `resolveDashboardAction`;
- persiste os novos turnos;
- valida a resposta com `PostMensagemResponseSchema`.

## 16. Integração com LLM

O projeto possui dois adapters.

### `StubLlmAdapter`

Usado para testes e cenários previsíveis. Permite executar a lógica da aplicação sem depender de rede ou modelo local.

### `OllamaLlmAdapter`

É o adapter real. Ele:

- usa o SDK `openai` apontando para uma base compatível com OpenAI;
- envia `systemPrompt`, histórico e mensagem do usuário;
- força `response_format: json_object`;
- aplica aliases de campo quando o modelo devolve nomes diferentes, como `rational` em vez de `rationale`;
- faz parse com Zod;
- possui retry configurável.

Variáveis de ambiente relevantes:

- `LLM_ADAPTER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `OLLAMA_API_KEY`
- `REDIS_URL`
- `PORT`
- `HOST`

Se `LLM_ADAPTER=stub`, o sistema usa o adapter fake. Caso contrário, usa Ollama.

## 17. Execução local e containers

O projeto pode ser executado de duas formas principais.

### Desenvolvimento local

Com dependências instaladas:

```bash
pnpm i
pnpm dev
```

O script `pnpm dev` usa Nx para subir `web` e `api`.

### Docker Compose

O `docker-compose.yml` sobe:

- `redis`
- `ollama`
- `ollama-init`
- `api`
- `web`

Pontos importantes:

- o serviço `ollama-init` faz o pull do modelo antes da API iniciar;
- a API conversa com o Ollama na rede interna via `http://ollama:11434/v1`;
- o frontend é servido por Nginx na porta `3000`;
- a API fica na `3001`.

O arquivo `docker-compose.gpu.yml` serve como override para hosts com GPU NVIDIA.

## 18. Scripts principais

No `package.json` raiz, os comandos mais relevantes são:

- `pnpm dev`: sobe `web` e `api` em modo de desenvolvimento
- `pnpm build`: build das apps
- `pnpm typecheck`: validação de build/types para apps e libs
- `pnpm lint`: lint do workspace
- `pnpm test`: testes do workspace
- `pnpm clean:artifacts`: limpeza de artefatos gerados

## 19. Testes e confiabilidade

O repositório possui cobertura de testes em várias libs, com destaque para:

- schemas de domínio;
- contratos HTTP;
- roteamento determinístico de resposta;
- caso de uso principal;
- matcher de curiosidades;
- testes do frontend da rota no app API;
- suíte opcional com LLM real em `libs/application/tests/application.real-llm.spec.ts`.

Uma convenção importante do projeto é que títulos de testes e mensagens user-facing devem permanecer em português.

## 20. Convenções importantes do código

Algumas decisões estruturais são importantes para qualquer LLM ou pessoa que vá gerar texto sobre o projeto:

- código, nomes técnicos e tipos ficam em inglês;
- mensagens exibidas ao usuário ficam em português do Brasil;
- o sistema adota validação com Zod em todas as fronteiras relevantes;
- a API não deve conter regra de negócio pesada;
- `libs/domain` deve permanecer pura, sem dependências de infraestrutura;
- o sistema sempre tenta retornar uma ação válida em vez de propagar erro para o cliente;
- o provider ativo é único, mesmo que existam múltiplas implementações registradas.

## 21. O que diferencia este projeto

Os pontos mais característicos da solução são:

- uso de LLM apenas onde ele agrega semântica, mas com decisão final controlada por regras determinísticas;
- separação explícita entre classificação, extração, decisão e mensagem amigável;
- resposta sempre tipada e validada, em vez de texto livre;
- suporte a contexto conversacional com Redis, sem transformar o sistema em um chat genérico;
- possibilidade de trocar a estratégia final de execução via provider único configurável.

## 22. Resumo executivo

Em uma frase: este projeto é uma camada conversacional sobre um dashboard Looker Studio, construída para interpretar linguagem natural, converter isso em ações estruturadas e executar essas ações com segurança, previsibilidade e rastreabilidade.

Em termos arquiteturais, ele combina:

- monorepo Nx;
- frontend React;
- API Fastify;
- validação forte com Zod;
- LLM local via Ollama;
- memória conversacional em Redis;
- providers intercambiáveis com seleção única;
- pipeline híbrido entre semântica probabilística e decisão determinística.

Esse conjunto faz com que o projeto seja adequado para cenários em que se quer explorar dashboards por linguagem natural sem abrir mão de controle sobre contratos, tipos e comportamento de produção.