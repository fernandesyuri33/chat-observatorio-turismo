---
applyTo: "libs/application/**"
---

# libs/application instructions

Scope: Use-case orchestration and policy-driven fallback flow.

## Allowed here

- Orchestrate request flow: LLM -> normalize -> confidence gate -> **provider** -> output validation.
- Apply fallback policy decisions (schema invalid, low confidence).
- Use ports/interfaces and typed data from **domain**, **contracts**, **policy**, **providers**.

## DO

- Keep fallback behavior policy-driven and centralized in **application**.
- Validate provider outputs with `DashboardAction` schema from **domain**.
- Keep deterministic orchestration with clear boundaries and typed contracts.

## DON'T

- Don’t import Fastify or any HTTP framework.
- Don’t define HTTP route DTO ownership here if they are public API contracts (belongs to **contracts**).
- Don’t implement concrete infrastructure adapters here.

## Import boundaries

- May import from: `@conversational/domain`, `@conversational/contracts`, `@conversational/policy`, `@conversational/providers` (interfaces/types), `@conversational/llm` (port/interfaces).
- Must not import from: `apps/api` or Fastify packages.

## Where should X go?

- "Retry LLM on schema invalid" -> `libs/application/src/resolve-dashboard-action.usecase.ts`.
- "HTTP body schema" -> `libs/contracts/src/*.schema.ts`.
- "Looker URL param mapping" -> **provider** implementation or policy config, not application core.

## Naming and placement

- Use-case files: `*.usecase.ts`.
- Fallback utilities: `fallback.ts`.
- Schema version selector/registry logic: `schema-registry.ts`.

## Pre-change checklist

- Did you keep **application** free of Fastify/HTTP framework imports?
- Are fallback paths still controlled by policy config?
- Is every inbound/outbound boundary validated (Zod at boundaries)?
- Did you preserve stable `DashboardAction` output behavior?
