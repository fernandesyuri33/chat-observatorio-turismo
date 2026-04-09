import { describe, it, expect } from "vitest";
import { summarizeAssistantTurn } from "../src/history-summarizer";

describe("summarizeAssistantTurn", () => {
  it("resume intent show com informationType e filtros", () => {
    const input = JSON.stringify({
      intent: "show",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: { classificacao: "alimentação", municipio: "Poços de Caldas" },
      confidence: 0.9,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("estabelecimentos");
    expect(result).toContain("município");
    expect(result).toContain("alimentação");
    expect(result).toContain("Poços de Caldas");
    expect(result).not.toContain("{");
  });

  it("resume intent show sem filtros", () => {
    const input = JSON.stringify({
      intent: "show",
      informationType: "funcionarios_ao_longo_do_tempo",
      proposedFilters: {},
      confidence: 0.85,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("Funcionários ao longo do tempo");
    expect(result).not.toContain("filtros");
  });

  it("resume intent contextual_orientation com filtros", () => {
    const input = JSON.stringify({
      intent: "contextual_orientation",
      proposedFilters: { municipio: "Lavras" },
      confidence: 0.7,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("contexto");
    expect(result).toContain("Lavras");
    expect(result).not.toContain("{");
  });

  it("resume intent initial_orientation", () => {
    const input = JSON.stringify({
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: 0.95,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("orientação inicial");
    expect(result).not.toContain("{");
  });

  it("resume intent curiosity_to_action", () => {
    const input = JSON.stringify({
      intent: "curiosity_to_action",
      proposedFilters: {},
      confidence: 0.8,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("curiosidade");
    expect(result).not.toContain("{");
  });

  it("retorna fallback para JSON inválido", () => {
    const result = summarizeAssistantTurn("isto não é JSON");

    expect(result).toContain("indisponível");
    expect(result).not.toContain("{");
  });

  it("retorna fallback para intent desconhecido", () => {
    const input = JSON.stringify({
      intent: "unknown_future_intent",
      proposedFilters: {},
      confidence: 0.5,
    });

    const result = summarizeAssistantTurn(input);

    expect(result).toContain("indisponível");
  });
});
