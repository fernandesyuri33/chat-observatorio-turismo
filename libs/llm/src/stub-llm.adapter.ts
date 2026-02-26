import type { z } from "zod";
import type { LlmPort } from "./llm.port.js";

/**
 * Adaptador LLM stub para desenvolvimento/testes.
 * Retorna saída estruturada determinística com base em palavras-chave.
 */
export class StubLlmAdapter implements LlmPort {
  async generateStructured<T>(schema: z.ZodType<T>, input: string): Promise<T> {
    const lower = input.toLowerCase();

    let raw: unknown;
    const proposedFilters: Record<string, unknown> = {};

    if (lower.includes("alimenta")) {
      proposedFilters["classificacao"] = "alimentação";
    } else if (lower.includes("transporte")) {
      proposedFilters["classificacao"] = "transportes";
    } else if (lower.includes("hosped")) {
      proposedFilters["classificacao"] = "hospedagem";
    }

    if (lower.includes("pouso alegre")) {
      proposedFilters["municipio"] = "Pouso Alegre";
    } else if (lower.includes("poços de caldas") || lower.includes("pocos de caldas")) {
      proposedFilters["municipio"] = "Poços de Caldas";
    }

    const isInitialOrientationQuestion =
      lower.includes("o que posso analisar") ||
      lower.includes("que dados posso obter") ||
      lower.includes("o que posso descobrir") ||
      lower.includes("o que posso ver aqui") ||
      lower.includes("por onde comec") ||
      lower.includes("por onde começ") ||
      lower.includes("como posso começar");

    const isCuriosityQuestion =
      (lower.includes("setor turístico") || lower.includes("setor turistico")) &&
      (lower.includes("evolu") || lower.includes("crescen") || lower.includes("melhor"));

    if (lower.includes("invalid")) {
      // Retorna um formato intencionalmente inválido para testar fallback
      raw = { bad: "data" };
    } else if (isCuriosityQuestion) {
      raw = {
        intent: "curiosity_to_action",
        proposedFilters,
        confidence: 0.9,
        rationale: "Pergunta de curiosidade que pode virar recorte acionável",
      };
    } else if (isInitialOrientationQuestion) {
      raw = {
        intent: "initial_orientation",
        proposedFilters: {},
        confidence: 0.9,
        rationale: "Usuário pediu orientação inicial sobre o que pode analisar",
      };
    } else if (lower.includes("saldo")) {
      raw = {
        intent: "show",
        informationType: "saldo_funcionarios_ao_longo_do_tempo",
        proposedFilters,
        confidence: 0.8,
        rationale: "Usuário pediu saldo de funcionários ao longo do tempo",
      };
    } else if (
      lower.includes("ao longo do tempo") ||
      lower.includes("tend")
    ) {
      raw = {
        intent: "show",
        informationType: "funcionarios_ao_longo_do_tempo",
        proposedFilters,
        confidence: 0.8,
        rationale: "Usuário pediu evolução de funcionários ao longo do tempo",
      };
    } else if (lower.includes("estabelecimento")) {
      raw = {
        intent: "show",
        informationType: "estabelecimentos_por_municipio",
        proposedFilters,
        confidence: 0.8,
        rationale: "Usuário pediu estabelecimentos por município",
      };
    } else if (lower.includes("funcion")) {
      raw = {
        intent: "show",
        informationType: "funcionarios_por_municipio",
        proposedFilters,
        confidence: 0.8,
        rationale: "Usuário pediu funcionários por município",
      };
    } else if (lower.includes("help") || lower.includes("ajuda")) {
      raw = {
        intent: "contextual_orientation",
        proposedFilters,
        confidence: 0.9,
        rationale: "Usuário pediu orientação contextual",
      };
    } else {
      raw = {
        intent: "show",
        informationType: "funcionarios_por_municipio",
        proposedFilters,
        confidence: 0.6,
        rationale: "Intenção genérica de filtro",
      };
    }

    // Faz parse com o schema fornecido — pode lançar erro se raw for inválido
    return schema.parse(raw);
  }
}
