# Copilot Instructions — Conversational Looker Dashboard

> **Maintenance rule:** whenever you add, remove, or rename a library, provider,
> schema version, environment variable, endpoint, or domain type, **update this
> file** in the same PR so it stays the single source of truth for all agents.

---

## 1. Project Overview

**Conversational Looker Dashboard** is a pnpm workspaces monorepo that turns natural-language
user messages into validated, structured dashboard actions. A local LLM (Ollama)
interprets the user's intent and the pipeline delegates to a single, configured
action provider (e.g. Looker, custom) that translates the intent into a typed
`DashboardAction` returned to the React frontend.

> **Single-provider model:** only one provider is active at a time, selected via
> `activeProvider` in `apps/api/config/policy.ts`. Every provider implementation must handle
> **all** intent types. The system supports multiple provider implementations so
> the active one can be swapped without code changes — but it never routes
> different intents to different providers simultaneously.

### Key Design Principles

| Principle | How it's applied |
|---|---|
| Clean / Hexagonal architecture | Domain models have zero infrastructure deps; ports define contracts; adapters live at the edge |
| Strategy pattern | `ActionProvider` interface — swap the active provider without touching the use case |
| Port / Adapter pattern | `LlmPort` interface — `StubLlmAdapter` for tests, `OllamaLlmAdapter` for production |
| Zod schema validation | Every boundary (HTTP request, LLM output, provider output, HTTP response) is validated with Zod |
| Schema registry | Versioned LLM output schemas selected at runtime via `INTENT_SCHEMA_VERSION` env var |
| Single-provider config | `activeProvider` in `apps/api/config/policy.ts` selects which provider handles **all** intents; every provider must support every intent type | <!-- Updated: policy moved from JSON file to typed TS module -->
| Safe default fallback | On low confidence or processing failures, the pipeline defaults to initial orientation (`explain_only`) |

---

## 2. Language & Localisation Rules

- **Code, comments, variable names, commit messages** → English.
- **All user-facing messages** (error strings, suggestions, fallback text,
  explain_only messages, LLM system prompts) → **always pt-BR Portuguese**.
- **Test descriptions** (`describe`/`it` titles in Vitest) → **pt-BR Portuguese**. <!-- Updated: standardized test title language -->
  There is no runtime locale toggle — the system is permanently pt-BR.
- When adding new user-facing copy, follow the same Portuguese tone already used
  in `resolve-dashboard-action.usecase.ts` and `fallback.ts`.

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Monorepo | pnpm workspaces | 9.x |
| Package manager | pnpm (workspaces) | 9.x |
| Language | TypeScript (ESNext modules, Bundler moduleResolution) | 6.0+ | <!-- Updated: bumped workspace TypeScript to 6.x to support TS6 deprecation controls -->
| API framework | Fastify + @fastify/cors | 4.28 |
| Schema validation | Zod | 3.23 |
| LLM runtime | Ollama (OpenAI-compatible API) | — |
| Conversation history store | Redis + ioredis | 7.x / 5.x | <!-- Updated: added Redis-backed conversation context persistence -->
| LLM structured output | openai SDK (JSON response format + Zod parse) | 4.x |
| Frontend | React + Vite | 18.x / 5.x |
| Testing | Vitest | 2.x |
| Dev runner | tsx (watch mode) | 4.x |

---

## 4. Repository Structure

```
apps/
  api/                         # Fastify HTTP server
    config/
      policy.ts                #   Runtime policy configuration (typed) <!-- Updated: typed runtime policy module -->
    src/
      main.ts                  #   Bootstrap: DI wiring, adapter selection, server start
      rotas.ts                 #   POST /mensagem — Zod-validated request/response <!-- Updated: routes consolidated from routes/ folder to rotas.ts -->
      history.service.ts       #   Redis-backed conversation history service (conversationId -> turns) <!-- Updated: added server-side conversation memory -->

  web/                         # React + Vite frontend
    src/
      App.tsx                  #   Single-page chat UI consuming /mensagem <!-- Updated: frontend endpoint path -->

libs/
  domain/                      # Pure domain types — zero infra deps
    src/
      dashboard-action.schema.ts   # DashboardAction discriminated union (5 variants) — all variants support optional `message` <!-- Updated: added message field to open_url, apply_filters, run_query for Stage 4 friendly messages -->
      friendly-message.schema.ts   # FriendlyMessageSchema — Stage 4 LLM output schema <!-- Updated: added for AI-generated friendly messages -->
      intent.v1.schema.ts          # IntentV1 — versioned LLM structured output schema
      index.ts                     # Barrel export

  contracts/                   # Shared HTTP API contracts (publishable package)
    src/
      dashboard-resolve-contract.schema.ts # Shared HTTP contract for POST /mensagem <!-- Updated: endpoint path -->
      index.ts

  application/                 # Use case orchestration
    src/
      resolve-dashboard-action.usecase.ts  # Core pipeline: LLM → normalize → confidence → provider → validate
      schema-registry.ts                   # Version → { schema, parse } registry
      fallback.ts                          # explainOnlyFallback() factory
      index.ts
    tests/
      application.real-llm.evaluation.spec.ts # Optional real-LLM evaluation datasets + metrics artifact generation <!-- Updated: added evaluation suite for TCC result collection -->

  policy/                      # Policy engine
    src/
      policy-config.schema.ts  # Zod schema for typed policy configuration
      policy-engine.ts         # Synonym resolution, strict filter normalization, NormalizedIntent <!-- Updated: removed normalizeIntent method, kept normalizeExtraction for v2 pipeline -->
      index.ts

  llm/                         # LLM port + adapters
    src/
      llm.port.ts              # LlmPort interface: generateStructured<T>(schema, input)
      stub-llm.adapter.ts      # StubLlmAdapter — deterministic keyword-matching (tests only)
      ollama-llm.adapter.ts    # OllamaLlmAdapter — real Ollama via OpenAI SDK + manual JSON/Zod handling <!-- Updated: removed Instructor dependency -->
      index.ts
      prompts/
        request-state.prompt.ts  # System prompt for Stage 1 (request state classification)
        extraction.prompt.ts     # System prompt for Stage 2 (structured extraction)
        friendly-message.prompt.ts # System prompt for Stage 4 (friendly message generation) <!-- Updated: added for AI-generated friendly messages -->

  providers/                   # Action provider strategies
    src/
      action-provider.ts       # ActionProvider interface
      looker/
        looker-provider.ts     # Builds open_url using informationType -> page mapping and params JSON
      custom/
        custom-provider.ts     # Returns run_query delegating to "tourism.resolve"
      index.ts
```

### Workspace package resolution <!-- Updated: removed tsconfig path aliases -->

Internal packages are resolved via pnpm workspace links and each package's
`package.json` exports/types fields, not `tsconfig` `paths` aliases.

Imports continue using package names:

- `@conversational/domain`
- `@conversational/contracts`
- `@conversational/application`
- `@conversational/policy`
- `@conversational/llm`
- `@conversational/providers`

---

## 5. Domain Models

### DashboardAction (discriminated union on `type`)

| Variant | Key fields |
|---|---|
| `open_url` | `url: string (URL)`, `title?: string`, `message?: string`, `meta?: Record` |
| `apply_filters` | `filters: Record<string, string\|number\|boolean\|string[]>`, `target?: "dashboard"\|"chart"\|"table"`, `message?: string`, `meta?: Record` |
| `run_query` | `function: string`, `args: Record`, `message?: string`, `meta?: Record` |
| `explain_only` | `message: string`, `suggestions: string[]`, `meta?: Record` |
<!-- Updated: removed missing-info action type to simplify response surface -->

Schema: `DashboardActionSchema` (Zod `z.discriminatedUnion` com 4 variantes).

### IntentV1 (LLM structured output)

```ts
{
  intent: "show" | "contextual_orientation" | "initial_orientation" | "curiosity_to_action", <!-- Updated: added curiosity-to-action intent for guided curiosity questions -->
  informationType?:
    | "estabelecimentos_por_municipio"
    | "funcionarios_por_municipio"
    | "funcionarios_ao_longo_do_tempo"
    | "saldo_funcionarios_ao_longo_do_tempo",
  proposedFilters: {
    classificacao?: "alimentação" | "transportes" | "comércios e serviços" | "hospedagem" | "entretenimento" | "agencias e operadores",
    municipio?: string
  },
  confidence: number,       // 0–1
  rationale?: string
}
```

`informationType` is required when `intent = "show"`, and omitted when `intent = "contextual_orientation"`, `intent = "initial_orientation"`, or `intent = "curiosity_to_action"`. <!-- Updated: curiosity_to_action also omits informationType -->

Schema: `IntentV1Schema`. Selected at runtime via the schema registry.

### Shared endpoint contracts

`PostMensagemRequestSchema` and `PostMensagemResponseSchema` live in
`libs/contracts/src/dashboard-resolve-contract.schema.ts` and must be reused by
API routes and frontend clients to avoid contract drift.

---

## 6. Core Pipeline (use case flow)

```
User message
  + conversation history (from Redis by `x-conversation-id`)
  → LLM.generateStructured(RequestStateSchema, message)   ← Stage 1: classify request state
  → LLM.generateStructured(ExtractionSchema, message)      ← Stage 2: extract informationType + filters
  → PolicyEngine.normalizeExtraction(extraction)            ← synonym/filter normalization
  → routeResponse(requestState, extraction, config)         ← Stage 3: deterministic decision
  → executeDecision(decision) → DashboardAction
  → enrichWithFriendlyMessage(action, userMessage)          ← Stage 4: AI-generated friendly message (best-effort)
  → DashboardActionSchema.parse(action)                    ← output validation
  → Return to HTTP layer

After generating a response action, the API persists the turn pair
(`user` message + serialized assistant intent normalizada) back to Redis and renews TTL.
```
<!-- Updated: 4-stage pipeline (request state → extraction → response decision → friendly message) -->

There is no intent-to-provider routing step — the single active provider
(injected at startup based on `activeProvider` config) handles every intent.

**Stage 4 (friendly message)** operates in **best-effort** mode: if the LLM call
fails, the original action is returned unchanged. The `message` field is injected
into all action types. For `explain_only`, it overwrites the template message.
For `open_url`, `apply_filters`, and `run_query`, it adds a new `message` field.
The frontend prefers `message` over type-specific fallbacks (`title`,
`JSON.stringify(filters)`, etc.).

At **every** failure point the pipeline returns an `explain_only` fallback
(never throws to the HTTP layer).

---

## 7. Policy Configuration (`apps/api/config/policy.ts`)

| Key | Purpose |
|---|---|
| `minConfidence` | Minimum confidence to proceed (below → fallback) |
| `synonyms` | `Record<string, string>` — maps user/LLM terms to canonical filter keys |
| `activeProvider` | `string` — id of the single active `ActionProvider` (e.g. `"looker"`, `"custom"`) <!-- Updated: replaced routing map with single activeProvider --> |
| `fallback.retryCount` | Number of LLM retries on schema parse failure |
| `fallback.contextualOrientationOptionCount` | Number of contextual `informationType` suggestions shown when user provides only filter context without a clear analysis recorte | <!-- Updated: configurable amount for semi-formulated contextual guidance --> |
| `history.maxMessages` | Maximum number of conversation turns (user + assistant) injected into LLM context per request (default: `3`) | <!-- Updated: configurable history window --> |
| `history.ttlSeconds` | Redis TTL for each conversation history key in seconds (default: `1800`) | <!-- Updated: configurable Redis expiration --> |
| `curiosityFaq` | Configurable FAQ-style examples used to deterministically validate and answer `curiosity_to_action` intents (`questionExamples[]`, `response`, `suggestion`, `informationType`) | <!-- Updated: added deterministic curiosity mapping config --> |
| `looker.baseUrl` | Looker Studio embed URL (with report/page path) |
| `looker.paramMap` | Optional global fallback mapping for canonical filter keys inside the `params` JSON payload |
| `looker.paramMapByInformationType` | Primary mapping of canonical filter keys → Looker Studio parameter names for each `informationType` (`ds17.*`, `ds18.*`, `ds19.*`, `ds20.*`) | <!-- Updated: filter params now vary by information type --> |
| `looker.informationTypeMap` | Maps `informationType` values → Looker page path/id (or full URL) <!-- Updated: page mapping by information type --> |

Policy normalization is strict by default: unknown filter keys are removed before provider execution. <!-- Updated: strict behavior is now fixed, no mode switch -->

---

## 8. LLM Adapter Selection

| Env var | Value | Effect |
|---|---|---|
| `LLM_ADAPTER` | `"stub"` | Uses `StubLlmAdapter` (deterministic, no network) |
| `LLM_ADAPTER` | _anything else or unset_ | Uses `OllamaLlmAdapter` (real Ollama) |

### Ollama configuration (env vars)

| Env var | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint |
| `OLLAMA_MODEL` | `llama3.1:8b` | Model identifier |
| `OLLAMA_API_KEY` | `ollama` | API key (Ollama default) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string used by the API conversation history service | <!-- Updated: added Redis environment variable --> |

The `OllamaLlmAdapter` constructor also accepts these as a config object for
programmatic override.

---

## 9. Endpoint Contract

### `POST /mensagem` <!-- Updated: endpoint renamed -->

**Request:**
```json
{
  "message": "string (min 1 char)"
}
```

**Headers:**
- `x-conversation-id: string` (optional, generated and persisted by frontend in `localStorage`) <!-- Updated: conversation identifier moved to header -->

**Response (always):**
```json
{
  "action": { /* DashboardAction */ }
}
```

Both request and response are validated with Zod schemas imported from
`@conversational/domain` in the route handler.
Invalid requests return `400` with `{ error, details }`.

> **Frontend guarantee:** The web app always receives a valid `DashboardAction`.
> Internal provider details are never leaked.

---

## 10. Development Commands

```bash
pnpm install                      # Install all dependencies
pnpm dev                          # Start API (tsx watch) + web (Vite) in parallel
pnpm build                        # Build all workspace projects
pnpm typecheck                    # TypeScript compilation check for all projects
pnpm test                         # Run all tests (Vitest)
pnpm lint                         # ESLint across all projects

# Individual project commands
pnpm -C apps/api dev              # API dev server (tsx watch, port 3001)
pnpm -C apps/web dev              # Vite dev server
pnpm -C libs/domain test          # Run tests for a specific library
pnpm -C libs/application test-real-llm # Run resolveDashboardAction tests against real Ollama LLM
pnpm test-real-llm:evaluation      # Run optional real-LLM evaluation datasets and write artifacts/real-llm-results.json (loads .env from repo root) <!-- Updated: enforce root entrypoint for evaluation env loading -->
```

### Running tests with the stub adapter

Unit tests always use `StubLlmAdapter` directly (injected via DI in the test
setup). The `LLM_ADAPTER` env var only affects the API server bootstrap.

For opt-in real LLM integration tests in `libs/application/tests/application.real-llm.spec.ts`, set:

| Env var | Value | Effect |
|---|---|---|
| `RUN_REAL_LLM_TESTS` | `"true"` | Enables `resolveDashboardAction` tests that use `OllamaLlmAdapter` instead of `StubLlmAdapter` | <!-- Updated: opt-in real LLM test suite -->
| `REAL_LLM_EVAL_DATASET` | dataset id like `"comandos_completos"` | Restricts `application.real-llm.evaluation.spec.ts` to one dataset when running evaluation | <!-- Updated: added dataset filter for real LLM evaluation -->
| `REAL_LLM_EVAL_CASE` | case name/message substring like `"Pouso Alegre"` | Restricts `application.real-llm.evaluation.spec.ts` to matching cases within the selected dataset(s) | <!-- Updated: added case filter for real LLM evaluation -->

The optional evaluation suite in `libs/application/tests/application.real-llm.evaluation.spec.ts`
also depends on `RUN_REAL_LLM_TESTS=true`. It records per-case timing, stage rationale,
and action metadata to `artifacts/real-llm-results.json`, while also writing a timestamped
snapshot in the same folder for later model comparisons. `REAL_LLM_EVAL_CASE` does not apply to
the fixed multi-turn scenario, which remains an all-or-nothing dataset.
Always run this suite through the root script `pnpm test-real-llm:evaluation`, since this entrypoint loads `.env` before delegating to `libs/application`. <!-- Updated: documented evaluation artifact and enforced root entrypoint -->

---

## 11. Architecture Rules (for agents and contributors)

1. **Domain stays pure.** `libs/domain` must never import from `libs/llm`,
   `libs/providers`, `libs/application`, or `apps/*`.

2. **Dependency direction:** `apps/api` → `libs/application` → `libs/domain`,
   `libs/policy`, `libs/llm` (port only), `libs/providers` (interface only).

   `apps/*` and external clients should import HTTP request/response contracts
   from `libs/contracts` instead of `libs/domain`. <!-- Updated: endpoint contract ownership moved to contracts lib -->

3. **New providers:** Implement `ActionProvider` in `libs/providers/src/<name>/`,
   export from `libs/providers/src/index.ts`, register in the provider registry
   map in `apps/api/src/main.ts`. The provider must handle **all** intent types.
   To make it active, set `activeProvider` in `apps/api/config/policy.ts` to the new id. <!-- Updated: typed policy source -->

4. **New LLM adapters:** Implement `LlmPort` in `libs/llm/src/`, export from
   barrel, add selection logic in `apps/api/src/main.ts`.

5. **New intent schema versions:** Create `intent.v2.schema.ts` in
   `libs/domain/src/`, register in `libs/application/src/schema-registry.ts`.

6. **Zod everywhere:** Every boundary (HTTP in, LLM out, provider out, HTTP out)
   must be validated with a Zod schema. Never trust unvalidated data.

7. **Fallback is mandatory.** Every failure path in the use case must return a
   valid `explain_only` action — never throw unhandled to the HTTP layer.

8. **No `rootDir` in tsconfig.json.** Library and app tsconfigs must not set
   `rootDir` — this causes TS6059 errors with cross-library path aliases.

9. **All generated artifacts are gitignored.** `.js`, `.d.ts`, `.js.map` files
   inside `src/` folders are build output — never commit them.

10. **Portuguese for users, English for code.** See §2.

---

## 12. Keeping This File Updated

When making changes to the codebase, update this file if any of the following
change:

- Libraries added, removed, or renamed
- New providers or LLM adapters
- New or changed environment variables
- Endpoint contract changes (request/response shapes)
- Domain model changes (DashboardAction variants, IntentV1 fields)
- New schema registry versions
- Policy config schema changes
- Architecture rules or conventions
- Dependency changes (new frameworks, major version bumps)
- Build/dev commands

Mark the change inline with a brief `<!-- Updated: description -->` comment if
helpful for future agents.
