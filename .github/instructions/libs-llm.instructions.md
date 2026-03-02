---
applyTo: "libs/llm/**"
---

# libs/llm instructions

Scope: LLM port and adapters for structured intent generation.

## Allowed here

- `LlmPort` interface and adapter implementations (stub, Ollama/OpenAI-compatible).
- Structured output calls that accept schema from caller.
- Adapter-specific config parsing and error normalization.

## DO

- Keep adapter contract narrow: `generateStructured<T>(schema, input)` style.
- Return data that can be validated against domain intent schemas.
- Keep networking/client details isolated inside adapter implementations.

## DON'T

- Don’t import Fastify or route-layer concerns.
- Don’t encode business fallback policy here (belongs to **application**).
- Don’t implement provider intent-to-action translation here.

## Import boundaries

- May import from: `@conversational/domain` (schema/types), shared lightweight utilities.
- Must not import from: `apps/api` route modules, `@conversational/application` use cases, provider implementations.

## Where should X go?

- "Intent Zod schema versions" -> `libs/domain` + schema registry in `libs/application`.
- "Retry técnico de chamada ao LLM" -> `libs/llm/src/*adapter.ts` (configurado no bootstrap em `apps/api/src/main.ts`).
- "LLM HTTP client config" -> `libs/llm/src/*adapter.ts`.

## Naming and placement

- Port in `llm.port.ts`.
- Adapters as `*-llm.adapter.ts`.
- Export via `libs/llm/src/index.ts`.

## Pre-change checklist

- Did you keep **llm** independent from Fastify and route code?
- Is business fallback logic still in **application**?
- Are adapter outputs intended for schema validation at boundaries?
- Are adapter-specific dependencies isolated to adapter files?
