import type { PolicyConfig } from "./policy-config.schema.js";

type InformationType =
  | "estabelecimentos_por_municipio"
  | "funcionarios_por_municipio"
  | "funcionarios_ao_longo_do_tempo"
  | "saldo_funcionarios_ao_longo_do_tempo";

type Classificacao =
  | "alimentação"
  | "transportes"
  | "comércios e serviços"
  | "hospedagem"
  | "entretenimento"
  | "agencias e operadores";

type IntentFilters = {
  classificacao?: Classificacao;
  municipio?: string;
};

export type NormalizedIntent =
  | {
      intent: "show";
      informationType: InformationType;
      proposedFilters: IntentFilters;
      confidence: number;
      rationale?: string;
    }
  | {
      intent: "contextual_orientation";
      informationType?: never;
      proposedFilters: IntentFilters;
      confidence: number;
      rationale?: string;
    }
  | {
      intent: "initial_orientation";
      informationType?: never;
      proposedFilters: IntentFilters;
      confidence: number;
      rationale?: string;
    }
  | {
      intent: "curiosity_to_action";
      informationType?: never;
      proposedFilters: IntentFilters;
      confidence: number;
      rationale?: string;
    };

const INFORMATION_TYPES = new Set<InformationType>([
  "estabelecimentos_por_municipio",
  "funcionarios_por_municipio",
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
]);

const CLASSIFICACOES = new Set<Classificacao>([
  "alimentação",
  "transportes",
  "comércios e serviços",
  "hospedagem",
  "entretenimento",
  "agencias e operadores",
]);

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

    const normalizedFilters: IntentFilters = {};
    if (
      typeof resolvedFilters["classificacao"] === "string" &&
      CLASSIFICACOES.has(resolvedFilters["classificacao"] as Classificacao)
    ) {
      normalizedFilters.classificacao = resolvedFilters["classificacao"] as Classificacao;
    }
    if (typeof resolvedFilters["municipio"] === "string" && resolvedFilters["municipio"].length > 0) {
      normalizedFilters.municipio = resolvedFilters["municipio"];
    }

    if (
      raw.intent === "contextual_orientation" ||
      raw.intent === "initial_orientation" ||
      raw.intent === "curiosity_to_action"
    ) {
      return {
        ...raw,
        proposedFilters: normalizedFilters,
      };
    }

    const mappedInformationType = synonyms[raw.informationType] ?? raw.informationType;
    const normalizedInformationType = INFORMATION_TYPES.has(mappedInformationType as InformationType)
      ? (mappedInformationType as InformationType)
      : raw.informationType;

    return {
      ...raw,
      informationType: normalizedInformationType,
      proposedFilters: normalizedFilters,
    };
  }
}
