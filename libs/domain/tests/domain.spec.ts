import { describe, it, expect } from "vitest";
import {
  DashboardActionSchema,
  IntentV1Schema,
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
