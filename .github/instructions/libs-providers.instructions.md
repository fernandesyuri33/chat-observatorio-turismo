---
applyTo: "libs/providers/**"
---

# libs/providers instructions

Scope: **Provider** strategy translating normalized intent into `DashboardAction`.

## Allowed here

- `ActionProvider` interface and provider implementations.
- Provider-specific translation logic (Intent -> `DashboardAction`).
- Provider-specific mapping details (e.g., URL/query arg mapping).

## DO

- Preserve the single-active-**provider** model (selected in config/env).
- Ensure each provider can handle all supported intents.
- Return output compatible with domain `DashboardAction` schema.

## DON'T

- Don’t implement multi-provider intent routing logic.
- Don’t import Fastify or HTTP route handlers.
- Don’t move fallback policy orchestration here (belongs to **application**).

## Import boundaries

- May import from: `@conversational/domain`, provider interface/types, lightweight utilities.
- Must not import from: `apps/api` route modules, Fastify, application orchestration internals.

## Where should X go?

- "Which provider is active now" -> config/env + bootstrap in `apps/api`.
- "How to transform `filter` intent into Looker URL" -> provider implementation in `libs/providers/src/looker`.
- "If provider output invalid, fallback behavior" -> `libs/application`.

## Naming and placement

- Interface in `action-provider.ts`.
- One folder per provider: `libs/providers/src/<provider-name>/`.
- Provider class file as `<provider-name>-provider.ts`.

## Pre-change checklist

- Did you keep single-active-**provider** semantics intact?
- Can this provider handle all intents?
- Is output shape aligned with stable `DashboardAction` contract?
- Did you avoid HTTP/Fastify and fallback orchestration concerns?
