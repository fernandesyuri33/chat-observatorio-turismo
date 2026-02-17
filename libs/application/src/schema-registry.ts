import type { z } from "zod";
import { IntentV1Schema } from "@conversational/domain";

// ── Schema Registry ─────────────────────────────────────────────
// Maps version strings to { schema, parse }.
// INTENT_SCHEMA_VERSION env var selects the active version at runtime.

export interface SchemaEntry<T = unknown> {
  schema: z.ZodType<T>;
  parse: (data: unknown) => T;
}

const registry: Record<string, SchemaEntry> = {
  v1: {
    schema: IntentV1Schema,
    parse: (data: unknown) => IntentV1Schema.parse(data),
  },
};

/**
 * Get a schema entry by version string.
 * Throws if the version is not registered.
 */
export function getSchemaEntry(version: string): SchemaEntry {
  const entry = registry[version];
  if (!entry) {
    throw new Error(`Unknown intent schema version: "${version}". Registered: ${Object.keys(registry).join(", ")}`);
  }
  return entry;
}

/**
 * Get the currently active schema version from env, defaulting to "v1".
 */
export function getActiveVersion(): string {
  return process.env["INTENT_SCHEMA_VERSION"] ?? "v1";
}

/**
 * Convenience: parse data through the currently active schema version.
 */
export function parseIntent(data: unknown) {
  const version = getActiveVersion();
  return getSchemaEntry(version).parse(data);
}

/**
 * Register a new schema version at runtime (for extensibility/testing).
 */
export function registerSchema(version: string, entry: SchemaEntry): void {
  registry[version] = entry;
}
