import { describe, it, expect } from "vitest";
import {
  DashboardActionSchema,
  IntentV1Schema,
} from "../src/index";

describe("DashboardActionSchema", () => {
  it("accepts a valid open_url action", () => {
    const result = DashboardActionSchema.safeParse({
      type: "open_url",
      url: "https://example.com/dashboard",
      title: "Test Dashboard",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("open_url");
    }
  });

  it("accepts a valid apply_filters action", () => {
    const result = DashboardActionSchema.safeParse({
      type: "apply_filters",
      filters: { cidade: "Sao Paulo", ano: "2024" },
      target: "dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid run_query action", () => {
    const result = DashboardActionSchema.safeParse({
      type: "run_query",
      function: "tourism.resolve",
      args: { intent: "show" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid explain_only action", () => {
    const result = DashboardActionSchema.safeParse({
      type: "explain_only",
      message: "I did not understand",
      suggestions: ["Try again"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown type", () => {
    const result = DashboardActionSchema.safeParse({
      type: "fly_to_moon",
      destination: "moon",
    });
    expect(result.success).toBe(false);
  });

  it("rejects open_url with invalid URL", () => {
    const result = DashboardActionSchema.safeParse({
      type: "open_url",
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = DashboardActionSchema.safeParse({
      type: "explain_only",
      // missing message and suggestions
    });
    expect(result.success).toBe(false);
  });
});

describe("IntentV1Schema", () => {
  it("accepts a valid intent", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      informationType: "funcionarios_por_municipio",
      proposedFilters: { municipio: "Pouso Alegre", classificacao: "hospedagem" },
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence > 1", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      proposedFilters: {},
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown intent type", () => {
    const result = IntentV1Schema.safeParse({
      intent: "fly",
      informationType: "funcionarios_por_municipio",
      proposedFilters: {},
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-orientation intent without informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "show",
      proposedFilters: {},
      confidence: 0.7,
    });
    expect(result.success).toBe(false);
  });

  it("accepts contextual_orientation intent without informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "contextual_orientation",
      proposedFilters: {},
      confidence: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts contextual_orientation intent with informationType null", () => {
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

  it("accepts initial_orientation intent without informationType", () => {
    const result = IntentV1Schema.safeParse({
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("accepts initial_orientation intent with informationType null", () => {
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
});
