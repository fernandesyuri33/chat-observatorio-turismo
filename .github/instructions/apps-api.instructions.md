---
applyTo: "apps/api/**"
---

# apps/api instructions

Scope: Fastify HTTP layer only (routes, middleware, auth, rate limit, logging, DI wiring, server bootstrap).

## Allowed here

- Fastify route handlers, plugins, HTTP error mapping, request context extraction.
- Import request/response schemas from `libs/contracts` and validate at route boundaries.
- Wire dependencies (LLM adapter, policy engine, provider, use case) in `main.ts`.

## DO

- Keep HTTP request/response schemas in **contracts** (`libs/contracts`) and import them here.
- Validate both request and response payloads with Zod schemas from **contracts**.
- Keep runtime selection of a single active **provider** via config/env.

## DON'T

- Don’t define public HTTP DTO schemas in `apps/api`.
- Don’t put orchestration/fallback logic here (belongs to **application**).
- Don’t add intent-to-multi-provider routing logic.

## Import boundaries

- May import from: `@conversational/application`, `@conversational/contracts`, `@conversational/policy`, `@conversational/llm`, `@conversational/providers`, `@conversational/domain` (types only when needed).
- Must not be imported by lower layers.

## Where should X go?

- "HTTP POST `/mensagem` request schema" -> `libs/contracts/src/dashboard-resolve-contract.schema.ts`.
- "Fallback to initial orientation on low confidence/errors" -> `libs/application/src/resolve-dashboard-action.usecase.ts`.
- "Domain `DashboardAction` schema" -> `libs/domain/src/dashboard-action.schema.ts`.

## Naming and placement

- Routes in `apps/api/src/routes/*.ts`.
- Bootstrap/DI in `apps/api/src/main.ts`.
- Keep HTTP concerns isolated from domain rules.

## Pre-change checklist

- Are all HTTP DTO validations imported from **contracts**?
- Is request/response validation performed at the route boundary?
- Did you avoid adding business logic that belongs to **application**?
- Is the single-active-**provider** model preserved?
