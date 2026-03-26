import { describe, it, expect } from "vitest";
import { routeResponse } from "../src/response-router";
import type { RequestStateResult, ExtractionResult } from "@conversational/domain";
import type { PolicyConfig } from "@conversational/policy";
import { baseTestPolicyConfig } from "./resolve-dashboard-action.shared";

function makeRequestState(
  requestState: RequestStateResult["requestState"],
  confidence = 0.9
): RequestStateResult {
  return { requestState, confidence };
}

function makeExtraction(
  overrides: Partial<ExtractionResult> = {}
): ExtractionResult {
  return {
    proposedFilters: {},
    confidence: 0.8,
    ...overrides,
  };
}

const config: PolicyConfig = baseTestPolicyConfig;

describe("routeResponse", () => {
  it("retorna give_initial_orientation para initial_orientation", () => {
    const decision = routeResponse({
      requestState: makeRequestState("initial_orientation"),
      extraction: null,
      config,
      message: "O que posso analisar?",
    });
    expect(decision.responseType).toBe("give_initial_orientation");
  });

  it("retorna give_initial_orientation para unclear", () => {
    const decision = routeResponse({
      requestState: makeRequestState("unclear"),
      extraction: null,
      config,
      message: "asdf",
    });
    expect(decision.responseType).toBe("give_initial_orientation");
  });

  it("retorna convert_curiosity_to_action quando há FAQ match", () => {
    const decision = routeResponse({
      requestState: makeRequestState("curiosity_to_action"),
      extraction: null,
      config,
      message: "O setor turístico de Poços de Caldas está evoluindo?",
    });
    expect(decision.responseType).toBe("convert_curiosity_to_action");
    if (decision.responseType === "convert_curiosity_to_action") {
      expect(decision.faqInformationType).toBe("funcionarios_ao_longo_do_tempo");
    }
  });

  it("retorna give_initial_orientation para curiosity sem FAQ match", () => {
    const configWithoutFaq = { ...config, curiosityFaq: [] };
    const decision = routeResponse({
      requestState: makeRequestState("curiosity_to_action"),
      extraction: null,
      config: configWithoutFaq,
      message: "O setor turístico está evoluindo?",
    });
    expect(decision.responseType).toBe("give_initial_orientation");
  });

  it("retorna give_contextual_orientation para context_only", () => {
    const decision = routeResponse({
      requestState: makeRequestState("context_only"),
      extraction: makeExtraction({
        proposedFilters: { municipio: "Pouso Alegre" },
      }),
      config,
      message: "Quero ver dados de Pouso Alegre",
    });
    expect(decision.responseType).toBe("give_contextual_orientation");
    if (decision.responseType === "give_contextual_orientation") {
      expect(decision.filters.municipio).toBe("Pouso Alegre");
    }
  });

  it("retorna execute_show para complete_show com extraction válida", () => {
    const decision = routeResponse({
      requestState: makeRequestState("complete_show"),
      extraction: makeExtraction({
        candidateInformationType: "funcionarios_por_municipio",
        proposedFilters: { municipio: "Pouso Alegre" },
        confidence: 0.8,
      }),
      config,
      message: "Mostre funcionários por município em Pouso Alegre",
    });
    expect(decision.responseType).toBe("execute_show");
    if (decision.responseType === "execute_show") {
      expect(decision.informationType).toBe("funcionarios_por_municipio");
      expect(decision.filters.municipio).toBe("Pouso Alegre");
    }
  });

  it("retorna give_initial_orientation para complete_show com confiança baixa", () => {
    const decision = routeResponse({
      requestState: makeRequestState("complete_show"),
      extraction: makeExtraction({
        candidateInformationType: "funcionarios_por_municipio",
        confidence: 0.3, // abaixo de minConfidence (0.5)
      }),
      config,
      message: "Acho que talvez funcionários",
    });
    expect(decision.responseType).toBe("give_initial_orientation");
  });

  it("retorna ask_missing_information para complete_show sem informationType mas com filtros", () => {
    const decision = routeResponse({
      requestState: makeRequestState("complete_show"),
      extraction: makeExtraction({
        proposedFilters: { municipio: "Pouso Alegre" },
        confidence: 0.8,
      }),
      config,
      message: "Mostre dados de Pouso Alegre",
    });
    expect(decision.responseType).toBe("ask_missing_information");
    if (decision.responseType === "ask_missing_information") {
      expect(decision.missing).toContain("informationType");
    }
  });

  it("retorna give_initial_orientation para complete_show sem extração", () => {
    const decision = routeResponse({
      requestState: makeRequestState("complete_show"),
      extraction: null,
      config,
      message: "Mostre dados",
    });
    expect(decision.responseType).toBe("give_initial_orientation");
  });

  it("retorna give_contextual_orientation para context_only sem extração", () => {
    const decision = routeResponse({
      requestState: makeRequestState("context_only"),
      extraction: null,
      config,
      message: "Dados de Pouso Alegre",
    });
    expect(decision.responseType).toBe("give_contextual_orientation");
  });
});
