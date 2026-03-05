---
applyTo: "libs/contracts/**"
---

# libs/contracts instructions

Scope: Public API contracts (request/response DTOs and Zod schemas) shared by API and external frontends.

## Allowed here

- Stable TypeScript DTO types and Zod schemas for HTTP request/response.
- Contract-level compatibility helpers and index exports.
- Backward-compatible evolution of API contracts.

## DO

- Keep contracts framework-agnostic and publishable.
- Use TypeScript + Zod only; keep dependencies minimal and portable.
- Preserve frontend compatibility and stable `DashboardAction` response shape.

## DON'T

- Don’t import Node-specific modules, Fastify types, or server runtime utilities.
- Don’t place domain-internal business rules here if not part of HTTP contract.
- Don’t create API route handlers here.

## Import boundaries

- May import from: `@conversational/domain` for shared domain shapes when appropriate.
- Must not import from: `apps/api`, `@conversational/application`, concrete adapters.

## Where should X go?

- "`POST /mensagem` request schema" -> `libs/contracts/src/dashboard-resolve-contract.schema.ts`.
- "Fastify route validation code" -> `apps/api/src/routes/*.ts`.
- "Intent schema used for LLM structured output" -> `libs/domain/src/intent.v*.schema.ts`.

## Naming and placement

- Contract schemas: `*.contract.schema.ts`.
- Public exports only from `libs/contracts/src/index.ts`.
- Keep file names explicit and version-friendly.

## Pre-change checklist

- Is this reusable by an external frontend repository without server deps?
- Did you avoid Fastify/Node runtime imports?
- Is the change backward compatible or intentionally versioned?
- Does response contract preserve stable `DashboardAction` expectations?
