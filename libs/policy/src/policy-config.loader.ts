import { readFileSync } from "node:fs";
import { PolicyConfigSchema, type PolicyConfig } from "./policy-config.schema.js";

/**
 * Carrega a configuração de política a partir de um caminho de arquivo JSON.
 * Valida o conteúdo com PolicyConfigSchema.
 */
export function loadPolicyConfig(filePath: string): PolicyConfig {
  const raw = readFileSync(filePath, "utf-8");
  const json: unknown = JSON.parse(raw);
  return PolicyConfigSchema.parse(json);
}
