/**
 * Este módulo define como os dados brutos de intent (retorno da LLM) são normalizados,
 * enquanto a camada de aplicação decide quando aplicar os resultados da policy.
 *
 * - Centraliza as regras de normalização de intent definidas na configuração de policy.
 * - Aplica sinônimos em chaves/valores de filtros e em tipos de informação.
 * - Garante sanitização estrita de filtros, removendo chaves desconhecidas.
 * - Valida e mantém apenas valores canônicos suportados para os filtros.
 * - Retorna uma intent normalizada e tipada para o caso de uso da aplicação.
 */
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

const ALLOWED_FILTER_KEYS = new Set<keyof IntentFilters>([
  "classificacao",
  "municipio",
]);

/**
 * PolicyEngine encapsula um PolicyConfig validado e fornece
 * métodos auxiliares para normalização de intent e consultas de política.
 */
export class PolicyEngine {
  constructor(private readonly config: PolicyConfig) {}

  getConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Normaliza um payload de intent:
   * - Aplica sinônimos em chaves e valores de filtro
   * - Rejeita chaves de filtro desconhecidas (estrito por padrão)
   */
  normalizeIntent(raw: NormalizedIntent): NormalizedIntent {
    const synonyms = this.config.synonyms;

    // Resolve chaves e valores de filtros propostos por meio de sinônimos
    const resolvedFilters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw.proposedFilters)) {
      const resolvedKey = synonyms[key] ?? key;
      if (typeof value === "string") {
        resolvedFilters[resolvedKey] = synonyms[value] ?? value;
      } else {
        resolvedFilters[resolvedKey] = value;
      }
    }

    // Rejeita chaves de filtro desconhecidas
    for (const key of Object.keys(resolvedFilters)) {
      if (!ALLOWED_FILTER_KEYS.has(key as keyof IntentFilters)) {
        delete resolvedFilters[key];
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
