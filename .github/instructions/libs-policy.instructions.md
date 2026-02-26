---
applyTo: "libs/policy/**"
---

# libs/policy instructions

Scope: **Policy** config schema/loader and intent normalization rules.

## Allowed here

- Policy config Zod schemas and loading/parsing code.
- Normalization and strict filter validation rules.
- Typed policy outputs consumed by **application**.

## DO

- Keep policy behavior declarative and config-driven.
- Validate policy config with Zod.
- Expose normalized policy decisions without transport coupling.

## DON'T

- Don’t add HTTP route/DTO handling.
- Don’t call external LLM providers directly.
- Don’t implement provider action generation here.

## Import boundaries

- May import from: `@conversational/domain` for shared intent/domain types where needed.
- Must not import from: Fastify/API modules, concrete provider adapters, application use-case orchestration.

## Where should X go?

- "`minConfidence` threshold rule" -> `libs/policy` config + normalization.
- "On low confidence default to initial orientation" -> **application** fallback execution using policy.
- "HTTP request schema" -> `libs/contracts`.

## Naming and placement

- Config schema in `policy-config.schema.ts`.
- Normalizer/engine in `policy-engine.ts`.

## Pre-change checklist

- Is this rule/config concern truly **policy** and not orchestration?
- Did you avoid HTTP/Fastify dependencies?
- Are policy outputs typed and consumable by **application**?
- Are config keys/schema updates validated with Zod?
