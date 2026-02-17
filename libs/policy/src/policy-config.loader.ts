import { readFileSync } from "node:fs";
import { PolicyConfigSchema, type PolicyConfig } from "./policy-config.schema.js";

/**
 * Load policy configuration from a JSON file path.
 * Validates the content against PolicyConfigSchema.
 */
export function loadPolicyConfig(filePath: string): PolicyConfig {
  const raw = readFileSync(filePath, "utf-8");
  const json: unknown = JSON.parse(raw);
  return PolicyConfigSchema.parse(json);
}
