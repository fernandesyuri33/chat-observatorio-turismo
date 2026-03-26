import type { z } from "zod";
import { IntentV1Schema, RequestStateResultSchema, ExtractionResultSchema } from "@conversational/domain";

// ── Registro de Schemas ─────────────────────────────────────────
// Mapeia strings de versão para { schema, parse }.
// A env var INTENT_SCHEMA_VERSION seleciona a versão ativa em runtime.

export interface SchemaEntry<T = unknown> {
  schema: z.ZodType<T>;
  parse: (data: unknown) => T;
}

const registry: Record<string, SchemaEntry> = {
  v1: {
    schema: IntentV1Schema,
    parse: (data: unknown) => IntentV1Schema.parse(data),
  },
  "request-state-v1": {
    schema: RequestStateResultSchema,
    parse: (data: unknown) => RequestStateResultSchema.parse(data),
  },
  "extraction-v1": {
    schema: ExtractionResultSchema,
    parse: (data: unknown) => ExtractionResultSchema.parse(data),
  },
};

/**
 * Obtém uma entrada de schema por string de versão.
 * Lança erro se a versão não estiver registrada.
 */
export function getSchemaEntry(version: string): SchemaEntry {
  const entry = registry[version];
  if (!entry) {
    throw new Error(`Versão de schema de intent desconhecida: "${version}". Registradas: ${Object.keys(registry).join(", ")}`);
  }
  return entry;
}

/**
 * Obtém da env a versão de schema atualmente ativa, com padrão "v1".
 */
export function getActiveVersion(): string {
  return process.env["INTENT_SCHEMA_VERSION"] ?? "v1";
}

/**
 * Faz parse dos dados pela versão de schema atualmente ativa.
 */
export function parseIntent(data: unknown) {
  const version = getActiveVersion();
  return getSchemaEntry(version).parse(data);
}

/**
 * Registra uma nova versão de schema em runtime (extensibilidade/testes).
 */
export function registerSchema(version: string, entry: SchemaEntry): void {
  registry[version] = entry;
}
