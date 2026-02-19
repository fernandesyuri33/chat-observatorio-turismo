---
applyTo: "libs/domain/**"
---

# libs/domain instructions

Scope: Pure **domain** models and domain Zod schemas.

## Allowed here

- Core domain types: intent, `DashboardAction`, and domain context models.
- Domain-level Zod schemas and versioned intent schemas.
- Pure transformations/utilities without infrastructure concerns.

## DO

- Keep domain framework-independent and side-effect free.
- Model discriminated unions and strict schema validation rules.
- Version schema changes explicitly when compatibility requires it.

## DON'T

- Don’t add HTTP request/response DTOs (belongs to **contracts**).
- Don’t import Fastify, API code, provider adapters, or policy loaders.
- Don’t encode transport concerns (status codes, route details).

## Import boundaries

- May import only general TS/Zod utilities.
- Must not import from: `apps/api`, `@conversational/application`, `@conversational/providers`, `@conversational/llm`, `@conversational/policy`, `@conversational/contracts`.

## Where should X go?

- "Public HTTP request body schema" -> `libs/contracts`.
- "Domain `DashboardAction` variants" -> `libs/domain/src/dashboard-action.schema.ts`.
- "Fallback strategy decision" -> `libs/application`.

## Naming and placement

- Domain schemas in `libs/domain/src/*.schema.ts`.
- Versioned intent schemas in `intent.v{n}.schema.ts`.
- Barrel export through `libs/domain/src/index.ts`.

## Pre-change checklist

- Is this truly **domain** logic, not transport/API logic?
- Are there zero imports from upper layers?
- Did schema changes preserve expected `DashboardAction` stability (or were versioned)?
- Is Zod used at the domain boundary being defined?
