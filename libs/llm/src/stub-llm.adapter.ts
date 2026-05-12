import type { z } from "zod";
import type { LlmPort, ConversationTurn } from "./llm.port.js";

// ── Keyword detection helpers (shared across schema dispatch) ───

function detectProposedFilters(lower: string): Record<string, unknown> {
  const filters: Record<string, unknown> = {};

  if (lower.includes("alimenta")) {
    filters["classificacao"] = "alimentação";
  } else if (lower.includes("transporte")) {
    filters["classificacao"] = "transportes";
  } else if (lower.includes("hosped")) {
    filters["classificacao"] = "hospedagem";
  }

  if (lower.includes("pouso alegre")) {
    filters["municipio"] = "Pouso Alegre";
  } else if (lower.includes("poços de caldas") || lower.includes("pocos de caldas")) {
    filters["municipio"] = "Poços de Caldas";
  }

  return filters;
}

function hasAnalysisSignal(lower: string): boolean {
  return (
    lower.includes("ao longo do tempo") ||
    lower.includes("saldo") ||
    lower.includes("estabelecimento") ||
    lower.includes("funcion")
  );
}

function isInitialOrientationQuestion(lower: string): boolean {
  return (
    lower.includes("o que posso analisar") ||
    lower.includes("que dados posso obter") ||
    lower.includes("o que posso descobrir") ||
    lower.includes("o que posso ver aqui") ||
    lower.includes("por onde comec") ||
    lower.includes("por onde começ") ||
    lower.includes("como posso começar")
  );
}

function isCuriosityQuestion(lower: string): boolean {
  return (
    (lower.includes("setor turístico") || lower.includes("setor turistico")) &&
    (lower.includes("evolu") || lower.includes("crescen") || lower.includes("melhor"))
  );
}

function isFilterOnlyContext(lower: string, filters: Record<string, unknown>): boolean {
  return Object.keys(filters).length > 0 && !hasAnalysisSignal(lower);
}

// ── Schema type detection ───────────────────────────────────────

function isRequestStateSchema(schema: z.ZodTypeAny): boolean {
  try {
    const result = schema.safeParse({
      requestState: "unclear",
      confidence: 0.5,
    });
    return result.success;
  } catch {
    return false;
  }
}

function isExtractionResultSchema(schema: z.ZodTypeAny): boolean {
  try {
    const result = schema.safeParse({
      proposedFilters: {},
      confidence: 0.5,
    });
    return result.success;
  } catch {
    return false;
  }
}

function isFriendlyMessageSchema(schema: z.ZodTypeAny): boolean {
  try {
    const result = schema.safeParse({ message: "teste" });
    // Distinguish from other schemas that also have a message field
    const rejectsExtraFields = !schema.safeParse({
      requestState: "unclear",
      confidence: 0.5,
    }).success;
    return result.success && rejectsExtraFields;
  } catch {
    return false;
  }
}

// ── Stub response builders per schema type ──────────────────────

function buildRequestStateResponse(lower: string, filters: Record<string, unknown>): unknown {
  if (lower.includes("invalid")) {
    return { bad: "data" };
  }

  if (isCuriosityQuestion(lower)) {
    return {
      requestState: "curiosity_to_action",
      confidence: 0.9,
      rationale: "Pergunta de curiosidade que pode virar recorte acionável",
    };
  }

  if (isInitialOrientationQuestion(lower)) {
    return {
      requestState: "initial_orientation",
      confidence: 0.9,
      rationale: "Usuário pediu orientação inicial sobre o que pode analisar",
    };
  }

  if (isFilterOnlyContext(lower, filters)) {
    return {
      requestState: "context_only",
      confidence: 0.85,
      rationale: "Usuário informou apenas recorte de filtro sem análise explícita",
    };
  }

  if (hasAnalysisSignal(lower)) {
    return {
      requestState: "complete_show",
      confidence: 0.9,
      rationale: "Usuário pediu visualização com indicação clara de análise",
    };
  }

  if (lower.includes("help") || lower.includes("ajuda")) {
    return {
      requestState: "unclear",
      confidence: 0.5,
      rationale: "Pedido vago de ajuda",
    };
  }

  return {
    requestState: "complete_show",
    confidence: 0.6,
    rationale: "Intenção genérica",
  };
}

function buildExtractionResponse(lower: string, filters: Record<string, unknown>): unknown {
  if (lower.includes("invalid")) {
    return { bad: "data" };
  }

  let candidateInformationType: string | undefined;

  if (lower.includes("saldo")) {
    candidateInformationType = "saldo_funcionarios_ao_longo_do_tempo";
  } else if (lower.includes("ao longo do tempo") || lower.includes("tend")) {
    candidateInformationType = "funcionarios_ao_longo_do_tempo";
  } else if (lower.includes("estabelecimento")) {
    candidateInformationType = "estabelecimentos_por_municipio";
  } else if (lower.includes("funcion")) {
    candidateInformationType = "funcionarios_por_municipio";
  }

  const raw: Record<string, unknown> = {
    proposedFilters: filters,
    confidence: candidateInformationType ? 0.8 : 0.6,
    rationale: candidateInformationType
      ? `Extração de informationType: ${candidateInformationType}`
      : "Sem informationType claro na mensagem",
  };

  if (candidateInformationType) {
    raw["candidateInformationType"] = candidateInformationType;
  }

  return raw;
}

function buildFriendlyMessageResponse(lower: string): unknown {
  if (lower.includes("estabelecimento")) {
    return { message: "Preparei a visualização dos estabelecimentos turísticos para você!" };
  }
  if (lower.includes("funcion") && lower.includes("ao longo")) {
    return { message: "Aqui está a evolução do número de funcionários no período!" };
  }
  if (lower.includes("saldo")) {
    return { message: "Trouxe o balanço entre admissões e desligamentos para você conferir!" };
  }
  if (lower.includes("funcion")) {
    return { message: "Veja como os funcionários estão distribuídos entre os municípios!" };
  }
  if (lower.includes("orientação") || lower.includes("o que posso")) {
    return { message: "Fico feliz em ajudar! Veja o que temos disponível para você explorar." };
  }
  return { message: "Aqui está o que encontrei para você!" };
}

function buildIntentV1Response(lower: string, filters: Record<string, unknown>): unknown {
  if (lower.includes("invalid")) {
    return { bad: "data" };
  }

  if (isCuriosityQuestion(lower)) {
    return {
      intent: "curiosity_to_action",
      proposedFilters: filters,
      confidence: 0.9,
      rationale: "Pergunta de curiosidade que pode virar recorte acionável",
    };
  }

  if (isInitialOrientationQuestion(lower)) {
    return {
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: 0.9,
      rationale: "Usuário pediu orientação inicial sobre o que pode analisar",
    };
  }

  if (isFilterOnlyContext(lower, filters)) {
    return {
      intent: "contextual_orientation",
      proposedFilters: filters,
      confidence: 0.85,
      rationale: "Usuário informou apenas recorte de filtro sem análise explícita",
    };
  }

  if (lower.includes("saldo")) {
    return {
      intent: "show",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
      proposedFilters: filters,
      confidence: 0.8,
      rationale: "Usuário pediu saldo de funcionários ao longo do tempo",
    };
  }

  if (lower.includes("ao longo do tempo") || lower.includes("tend")) {
    return {
      intent: "show",
      informationType: "funcionarios_ao_longo_do_tempo",
      proposedFilters: filters,
      confidence: 0.8,
      rationale: "Usuário pediu evolução de funcionários ao longo do tempo",
    };
  }

  if (lower.includes("estabelecimento")) {
    return {
      intent: "show",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: filters,
      confidence: 0.8,
      rationale: "Usuário pediu estabelecimentos por município",
    };
  }

  if (lower.includes("funcion")) {
    return {
      intent: "show",
      informationType: "funcionarios_por_municipio",
      proposedFilters: filters,
      confidence: 0.8,
      rationale: "Usuário pediu funcionários por município",
    };
  }

  if (lower.includes("help") || lower.includes("ajuda")) {
    return {
      intent: "contextual_orientation",
      proposedFilters: filters,
      confidence: 0.9,
      rationale: "Usuário pediu orientação contextual",
    };
  }

  return {
    intent: "show",
    informationType: "funcionarios_por_municipio",
    proposedFilters: filters,
    confidence: 0.6,
    rationale: "Intenção genérica de filtro",
  };
}

// ── Adaptador ───────────────────────────────────────────────────

/**
 * Adaptador LLM stub para desenvolvimento/testes.
 * Retorna saída estruturada determinística com base em palavras-chave.
 * Faz dispatch por tipo de schema: RequestStateResultSchema, ExtractionResultSchema ou IntentV1Schema.
 * O parâmetro `history` e `systemPrompt` são aceitos mas ignorados — comportamento determinístico preservado.
 */
export class StubLlmAdapter implements LlmPort {
  async generateStructured<T>(
    schema: z.ZodType<T>,
    input: string,
    systemPrompt: string,
    history?: ConversationTurn[],
  ): Promise<T> {
    // Keep signature aligned with LlmPort while preserving deterministic behavior.
    void systemPrompt;
    void history;

    const lower = input.toLowerCase();
    const filters = detectProposedFilters(lower);

    let raw: unknown;

    if (isRequestStateSchema(schema)) {
      raw = buildRequestStateResponse(lower, filters);
    } else if (isExtractionResultSchema(schema)) {
      raw = buildExtractionResponse(lower, filters);
    } else if (isFriendlyMessageSchema(schema)) {
      raw = buildFriendlyMessageResponse(lower);
    } else {
      // Fallback: assume IntentV1Schema (legado) ou qualquer schema desconhecido
      raw = buildIntentV1Response(lower, filters);
    }

    return schema.parse(raw);
  }
}

