/**
 * Este módulo define como os dados brutos de intent (retorno da LLM) são normalizados,
 * enquanto a camada de aplicação decide quando aplicar os resultados da policy.
 *
 * - Centraliza as regras de normalização de intent definidas na configuração de policy.
 * - Aplica sinônimos em chaves/valores de filtros e em tipos de informação.
 * - Garante sanitização estrita de filtros, removendo chaves desconhecidas.
 * - Valida e mantém apenas valores canônicos suportados para os filtros.
 * - Retorna dados normalizados e tipados para o caso de uso da aplicação.
 */
import type { ExtractionResult } from "@conversational/domain";
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
   * Normaliza um ExtractionResult.
   * Aplica sinônimos e sanitização de filtros sem reclassificar intent
   * (a responsabilidade de classificação pertence ao request state / response router).
   */
  normalizeExtraction(raw: ExtractionResult): ExtractionResult {
    const synonyms = this.config.synonyms;

    // Resolve candidateInformationType via sinônimos
    let normalizedInformationType = raw.candidateInformationType;
    if (normalizedInformationType) {
      const mapped = synonyms[normalizedInformationType] ?? normalizedInformationType;
      normalizedInformationType = INFORMATION_TYPES.has(mapped as InformationType)
        ? (mapped as ExtractionResult["candidateInformationType"])
        : normalizedInformationType;
    }

    // Resolve filtros via sinônimos
    const resolvedFilters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw.proposedFilters)) {
      if (value === undefined || value === null) continue;
      const resolvedKey = synonyms[key] ?? key;
      if (typeof value === "string") {
        resolvedFilters[resolvedKey] = synonyms[value] ?? value;
      } else {
        resolvedFilters[resolvedKey] = value;
      }
    }

    // Sanitiza filtros
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

    return {
      candidateInformationType: normalizedInformationType,
      proposedFilters: normalizedFilters,
      confidence: raw.confidence,
      rationale: raw.rationale,
    };
  }
}
