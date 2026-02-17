import type { PolicyConfig } from "./policy-config.schema.js";

export interface NormalizedIntent {
  intent: string;
  proposedFilters: Record<string, unknown>;
  entities: Record<string, unknown>;
  confidence: number;
  rationale?: string;
}

/**
 * PolicyEngine wraps a validated PolicyConfig and provides
 * helper methods for intent normalization and policy queries.
 */
export class PolicyEngine {
  constructor(private readonly config: PolicyConfig) {}

  getConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Normalize an intent payload:
   * - Apply synonyms to filter keys and values
   * - Optionally clamp or reject fields based on mode
   */
  normalizeIntent(raw: NormalizedIntent): NormalizedIntent {
    const synonyms = this.config.synonyms;

    // Resolve intent synonym
    const resolvedIntent = synonyms[raw.intent] ?? raw.intent;

    // Resolve proposed filter keys and values through synonyms
    const resolvedFilters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw.proposedFilters)) {
      const resolvedKey = synonyms[key] ?? key;
      if (typeof value === "string") {
        resolvedFilters[resolvedKey] = synonyms[value] ?? value;
      } else {
        resolvedFilters[resolvedKey] = value;
      }
    }

    // In strict mode, reject unknown metrics/dimensions
    if (this.config.mode === "strict") {
      for (const key of Object.keys(resolvedFilters)) {
        const isKnown =
          this.config.knownMetrics.includes(key) ||
          this.config.knownDimensions.includes(key);
        if (!isKnown) {
          delete resolvedFilters[key];
        }
      }
    }

    return {
      ...raw,
      intent: resolvedIntent,
      proposedFilters: resolvedFilters,
    };
  }
}
