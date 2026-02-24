# Copilot Instructions — Conversational Looker Dashboard

> **Maintenance rule:** whenever you add, remove, or rename a library, provider,
> schema version, environment variable, endpoint, or domain type, **update this
> file** in the same PR so it stays the single source of truth for all agents.

---

## 1. Project Overview

**Conversational Looker Dashboard** is an Nx monorepo that turns natural-language
user messages into validated, structured dashboard actions. A local LLM (Ollama)
interprets the user's intent and the pipeline delegates to a single, configured
action provider (e.g. Looker, custom) that translates the intent into a typed
`DashboardAction` returned to the React frontend.

> **Single-provider model:** only one provider is active at a time, selected via
> `activeProvider` in `policy.json`. Every provider implementation must handle
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
| Single-provider config | `activeProvider` in `policy.json` selects which provider handles **all** intents; every provider must support every intent type |
| Safe default fallback | On low confidence or processing failures, the pipeline defaults to initial orientation (`explain_only`) |

---

## 2. Language & Localisation Rules

- **Code, comments, variable names, commit messages** → English.
- **All user-facing messages** (error strings, suggestions, fallback text,
  explain_only messages, LLM system prompts) → **always pt-BR Portuguese**.
  There is no runtime locale toggle — the system is permanently pt-BR.
- When adding new user-facing copy, follow the same Portuguese tone already used
  in `resolve-dashboard-action.usecase.ts` and `fallback.ts`.

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Monorepo | Nx | 22.x |
| Package manager | pnpm (workspaces) | 9.x |
| Language | TypeScript (ESNext modules, Bundler moduleResolution) | 5.7+ |
| API framework | Fastify + @fastify/cors | 4.28 |
| Schema validation | Zod | 3.23 |
| LLM runtime | Ollama (OpenAI-compatible API) | — |
| LLM structured output | @instructor-ai/instructor (JSON mode) + openai SDK | 1.x / 4.x |
| Frontend | React + Vite | 18.x / 5.x |
| Testing | Vitest | 2.x |
| Dev runner | tsx (watch mode) | 4.x |

---

## 4. Repository Structure

```
apps/
  api/                         # Fastify HTTP server
    src/
      main.ts                  #   Bootstrap: DI wiring, adapter selection, server start
      routes/
        dashboard.ts           #   POST /dashboard/resolve — Zod-validated request/response
    config/
      policy.json              #   Runtime policy configuration

  web/                         # React + Vite frontend
    src/
      App.tsx                  #   Single-page chat UI consuming /dashboard/resolve

libs/
  domain/                      # Pure domain types — zero infra deps
    src/
      dashboard-action.schema.ts   # DashboardAction discriminated union (4 variants)
      intent.v1.schema.ts          # IntentV1 — versioned LLM structured output schema
      index.ts                     # Barrel export

  contracts/                   # Shared HTTP API contracts (publishable package)
    src/
      dashboard-resolve-contract.schema.ts # Shared HTTP contract for POST /dashboard/resolve
      index.ts

  application/                 # Use case orchestration
    src/
      resolve-dashboard-action.usecase.ts  # Core pipeline: LLM → normalize → confidence → provider → validate
      schema-registry.ts                   # Version → { schema, parse } registry
      fallback.ts                          # explainOnlyFallback() factory
      index.ts

  policy/                      # Policy engine
    src/
      policy-config.schema.ts  # Zod schema for policy.json
      policy-config.loader.ts  # Loads + validates policy.json from disk
      policy-engine.ts         # Synonym resolution, mode-based filtering, NormalizedIntent
      index.ts

  llm/                         # LLM port + adapters
    src/
      llm.port.ts              # LlmPort interface: generateStructured<T>(schema, input)
      stub-llm.adapter.ts      # StubLlmAdapter — deterministic keyword-matching (tests only)
      ollama-llm.adapter.ts    # OllamaLlmAdapter — real Ollama via Instructor + OpenAI SDK
      index.ts

  providers/                   # Action provider strategies
    src/
      action-provider.ts       # ActionProvider interface + ResolveContext type
      looker/
        looker-provider.ts     # Builds open_url using informationType -> page mapping and params JSON
      custom/
        custom-provider.ts     # Returns run_query delegating to "tourism.resolve"
      index.ts
```

### Package aliases (tsconfig paths)

| Alias | Path |
|---|---|
| `@conversational/domain` | `libs/domain/src/index.ts` |
| `@conversational/contracts` | `libs/contracts/src/index.ts` |
| `@conversational/application` | `libs/application/src/index.ts` |
| `@conversational/policy` | `libs/policy/src/index.ts` |
| `@conversational/llm` | `libs/llm/src/index.ts` |
| `@conversational/providers` | `libs/providers/src/index.ts` |

---

## 5. Domain Models

### DashboardAction (discriminated union on `type`)

| Variant | Key fields |
|---|---|
| `open_url` | `url: string (URL)`, `title?: string`, `meta?: Record` |
| `apply_filters` | `filters: Record<string, string\|number\|boolean\|string[]>`, `target?: "dashboard"\|"chart"\|"table"`, `meta?: Record` |
| `run_query` | `function: string`, `args: Record`, `meta?: Record` |
| `explain_only` | `message: string`, `suggestions: string[]`, `meta?: Record` |

Schema: `DashboardActionSchema` (Zod `z.discriminatedUnion`).

### IntentV1 (LLM structured output)

```ts
{
  intent: "show" | "contextual_orientation" | "initial_orientation",
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

`informationType` is required when `intent = "show"`, and omitted when `intent = "contextual_orientation"` or `intent = "initial_orientation"`. <!-- Updated: removed help and added contextual orientation intent -->

Schema: `IntentV1Schema`. Selected at runtime via the schema registry.

### Shared endpoint contracts

`ResolveDashboardRequestSchema` and `ResolveDashboardResponseSchema` live in
`libs/contracts/src/dashboard-resolve-contract.schema.ts` and must be reused by
API routes and frontend clients to avoid contract drift.

---

## 6. Core Pipeline (use case flow)

```
User message
  → LLM.generateStructured(IntentSchema, message)
  → PolicyEngine.normalizeIntent(rawIntent)
  → Confidence check (minConfidence from policy)
  → activeProvider.generate(normalizedIntent, ctx)
  → DashboardActionSchema.parse(action)     ← output validation
  → Return to HTTP layer
```

There is no intent-to-provider routing step — the single active provider
(injected at startup based on `activeProvider` config) handles every intent.

At **every** failure point the pipeline returns an `explain_only` fallback
(never throws to the HTTP layer).

---

## 7. Policy Configuration (`apps/api/config/policy.json`)

| Key | Purpose |
|---|---|
| `mode` | `"free"` / `"guided"` / `"strict"` — progressive hardening of allowed inputs |
| `minConfidence` | Minimum confidence to proceed (below → fallback) |
| `synonyms` | `Record<string, string>` — maps user/LLM terms to canonical filter keys |
| `activeProvider` | `string` — id of the single active `ActionProvider` (e.g. `"looker"`, `"custom"`) <!-- Updated: replaced routing map with single activeProvider --> |
| `fallback.retryCount` | Number of LLM retries on schema parse failure |
| `fallback.contextualOrientationOptionCount` | Number of contextual `informationType` suggestions shown when user provides only filter context without a clear analysis recorte | <!-- Updated: configurable amount for semi-formulated contextual guidance --> |
| `looker.baseUrl` | Looker Studio embed URL (with report/page path) |
| `looker.paramMap` | Maps canonical filter keys → keys used inside the `params` JSON payload |
| `looker.informationTypeMap` | Maps `informationType` values → Looker page path/id (or full URL) <!-- Updated: page mapping by information type --> |

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

The `OllamaLlmAdapter` constructor also accepts these as a config object for
programmatic override.

---

## 9. Endpoint Contract

### `POST /dashboard/resolve`

**Request:**
```json
{
  "message": "string (min 1 char)",
  "ctx": {                          // optional
    "dashboardId": "string",        // optional
    "currentFilters": {}            // optional Record<string, any>
  }
}
```

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
pnpm install              # Install all dependencies
pnpm dev                  # Start API (tsx watch) + web (Vite) in parallel
pnpm build                # Build API + web
pnpm typecheck            # TypeScript compilation check for all projects
pnpm test                 # Run all tests (Vitest)
pnpm lint                 # ESLint across all projects

# Individual project targets via Nx
npx nx run api:dev        # API dev server (tsx watch, port 3001)
npx nx run web:dev        # Vite dev server
npx nx run <lib>:test     # Run tests for a specific library
npx nx run application:test-real-llm # Run resolveDashboardAction tests against real Ollama LLM
```

### Running tests with the stub adapter

Unit tests always use `StubLlmAdapter` directly (injected via DI in the test
setup). The `LLM_ADAPTER` env var only affects the API server bootstrap.

For opt-in real LLM integration tests in `libs/application/tests/application.real-llm.spec.ts`, set:

| Env var | Value | Effect |
|---|---|---|
| `RUN_REAL_LLM_TESTS` | `"true"` | Enables `resolveDashboardAction` tests that use `OllamaLlmAdapter` instead of `StubLlmAdapter` | <!-- Updated: opt-in real LLM test suite -->

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
   To make it active, set `activeProvider` in `policy.json` to the new id.

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
