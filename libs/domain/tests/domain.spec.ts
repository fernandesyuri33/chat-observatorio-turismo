import { describe, it, expect } from "vitest";
import {
  DashboardActionSchema,
  IntentV1Schema,
  RequestStateResultSchema,
  ExtractionResultSchema,
  ResponseDecisionSchema,
} from "../src/index";

describe("DashboardActionSchema", () => {
  it("aceita uma ação open_url válida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "open_url",
      url: "https://example.com/dashboard",
      title: "Dashboard de teste",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("open_url");
    }
  });

  it("aceita uma ação apply_filters válida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "apply_filters",
      filters: { cidade: "Sao Paulo", ano: "2024" },
      target: "dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("aceita uma ação run_query válida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "run_query",
      function: "tourism.resolve",
      args: { intent: "show" },
    });
    expect(result.success).toBe(true);
  });

  it("aceita uma ação explain_only válida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "explain_only",
      message: "Não entendi",
      suggestions: ["Tente novamente"],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita um tipo desconhecido", () => {
    const result = DashboardActionSchema.safeParse({
      type: "fly_to_moon",
      destination: "moon",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita open_url com URL inválida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "open_url",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita campos obrigatórios ausentes", () => {
    const result = DashboardActionSchema.safeParse({
      type: "explain_only",
      // faltando message e suggestions
    });
    expect(result.success).toBe(false);
  });

  it("aceita uma ação ask_missing_information válida", () => {
    const result = DashboardActionSchema.safeParse({
      type: "ask_missing_information",
      message: "Preciso saber qual análise você quer ver.",
      suggestions: ["Estabelecimentos por município"],
      missing: ["informationType"],
      context: { municipio: "Pouso Alegre" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("ask_missing_information");
    }
  });

  it("aceita ask_missing_information sem context", () => {
    const result = DashboardActionSchema.safeParse({
      type: "ask_missing_information",
      message: "Qual análise você quer ver?",
      suggestions: [],
      missing: ["informationType"],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita ask_missing_information sem missing", () => {
    const result = DashboardActionSchema.safeParse({
      type: "ask_missing_information",
      message: "Qual análise?",
      suggestions: [],
      // faltando missing
    });
    expect(result.success).toBe(false);
  });
});

describe("IntentV1Schema", () => {
  it("aceita uma intent válida", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      informationType: "funcionarios_por_municipio",
      proposedFilters: { municipio: "Pouso Alegre", classificacao: "hospedagem" },
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita confidence > 1", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      proposedFilters: {},
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita tipo de intent desconhecido", () => {
    const result = IntentV1Schema.safeParse({
      intent: "fly",
      informationType: "funcionarios_por_municipio",
      proposedFilters: {},
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita intent não orientacional sem informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      proposedFilters: {},
      confidence: 0.7,
    });
    expect(result.success).toBe(false);
  });

  it("aceita intent contextual_orientation sem informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "contextual_orientation",
      proposedFilters: {},
      confidence: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it("aceita intent contextual_orientation com informationType null", () => {
    const result = IntentV1Schema.safeParse({
      intent: "contextual_orientation",
      informationType: null,
      proposedFilters: {},
      confidence: 0.7,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.informationType).toBeUndefined();
    }
  });

  it("aceita intent initial_orientation sem informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("aceita intent initial_orientation com informationType null", () => {
    const result = IntentV1Schema.safeParse({
      intent: "initial_orientation",
      informationType: null,
      proposedFilters: {},
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.informationType).toBeUndefined();
    }
  });

  it("aceita intent curiosity_to_action sem informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "curiosity_to_action",
      proposedFilters: {},
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("aceita intent curiosity_to_action com informationType null", () => {
    const result = IntentV1Schema.safeParse({
      intent: "curiosity_to_action",
      informationType: null,
      proposedFilters: {},
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.informationType).toBeUndefined();
    }
  });
});

describe("RequestStateResultSchema", () => {
  it("aceita um request state válido", () => {
    const result = RequestStateResultSchema.safeParse({
      requestState: "complete_show",
      confidence: 0.9,
      rationale: "Pedido claro de visualização",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestState).toBe("complete_show");
    }
  });

  it("aceita todos os valores possíveis de requestState", () => {
    for (const state of ["complete_show", "context_only", "initial_orientation", "curiosity_to_action", "unclear"]) {
      const result = RequestStateResultSchema.safeParse({
        requestState: state,
        confidence: 0.5,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejeita requestState desconhecido", () => {
    const result = RequestStateResultSchema.safeParse({
      requestState: "invalid_state",
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita confidence fora do intervalo 0-1", () => {
    const result = RequestStateResultSchema.safeParse({
      requestState: "complete_show",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rationale é opcional", () => {
    const result = RequestStateResultSchema.safeParse({
      requestState: "unclear",
      confidence: 0.3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rationale).toBeUndefined();
    }
  });
});

describe("ExtractionResultSchema", () => {
  it("aceita extração com informationType e filtros", () => {
    const result = ExtractionResultSchema.safeParse({
      candidateInformationType: "funcionarios_por_municipio",
      proposedFilters: { classificacao: "hospedagem", municipio: "Pouso Alegre" },
      confidence: 0.8,
      rationale: "Extração clara",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.candidateInformationType).toBe("funcionarios_por_municipio");
    }
  });

  it("aceita extração sem informationType", () => {
    const result = ExtractionResultSchema.safeParse({
      proposedFilters: { municipio: "Pouso Alegre" },
      confidence: 0.6,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.candidateInformationType).toBeUndefined();
    }
  });

  it("aceita extração com filtros vazios", () => {
    const result = ExtractionResultSchema.safeParse({
      proposedFilters: {},
      confidence: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita informationType inválido", () => {
    const result = ExtractionResultSchema.safeParse({
      candidateInformationType: "tipo_invalido",
      proposedFilters: {},
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("ResponseDecisionSchema", () => {
  it("aceita execute_show válido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "execute_show",
      informationType: "funcionarios_por_municipio",
      filters: { municipio: "Pouso Alegre" },
    });
    expect(result.success).toBe(true);
  });

  it("aceita ask_missing_information válido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "ask_missing_information",
      missing: ["informationType"],
      context: { municipio: "Pouso Alegre" },
    });
    expect(result.success).toBe(true);
  });

  it("aceita give_initial_orientation válido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "give_initial_orientation",
    });
    expect(result.success).toBe(true);
  });

  it("aceita give_contextual_orientation válido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "give_contextual_orientation",
      filters: { classificacao: "hospedagem" },
    });
    expect(result.success).toBe(true);
  });

  it("aceita convert_curiosity_to_action válido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "convert_curiosity_to_action",
      faqResponse: "Uma forma de explorar...",
      faqSuggestion: "Visualizar funcionários",
      faqInformationType: "funcionarios_ao_longo_do_tempo",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita responseType desconhecido", () => {
    const result = ResponseDecisionSchema.safeParse({
      responseType: "unknown_type",
    });
    expect(result.success).toBe(false);
  });
});
