import { describe, it, expect } from "vitest";
import { findCuriosityFaqMatch, scoreFaqMatch } from "../src/curiosity-matcher";
import type { PolicyConfig } from "@conversational/policy";

const testFaqEntries: NonNullable<PolicyConfig["curiosityFaq"]> = [
  {
    questionExamples: [
      "O setor turístico de Poços de Caldas está evoluindo?",
      "O turismo de Poços de Caldas está crescendo?",
    ],
    response:
      "Uma forma de explorar essa questão é visualizar a evolução da quantidade de funcionários ao longo do tempo.",
    suggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
    informationType: "funcionarios_ao_longo_do_tempo",
  },
];

describe("scoreFaqMatch", () => {
  it("retorna score positivo para mensagem similar ao exemplo", () => {
    const score = scoreFaqMatch(
      "O setor turístico de Poços de Caldas está evoluindo?",
      "O setor turístico de Poços de Caldas está evoluindo?"
    );
    expect(score).toBeGreaterThan(0.45);
  });

  it("retorna 0 para mensagens sem overlap significativo", () => {
    const score = scoreFaqMatch(
      "Mostre funcionários por município",
      "O setor turístico de Poços de Caldas está evoluindo?"
    );
    expect(score).toBeLessThan(0.45);
  });

  it("retorna 0 para mensagem vazia", () => {
    const score = scoreFaqMatch("", "O setor turístico está evoluindo?");
    expect(score).toBe(0);
  });

  it("retorna 0 para exemplo vazio", () => {
    const score = scoreFaqMatch("O setor turístico está evoluindo?", "");
    expect(score).toBe(0);
  });

  it("retorna 0 quando interseção é menor que 2 tokens", () => {
    const score = scoreFaqMatch("turístico", "O setor turístico está evoluindo?");
    expect(score).toBe(0);
  });
});

describe("findCuriosityFaqMatch", () => {
  it("retorna a entrada FAQ correspondente quando há match", () => {
    const match = findCuriosityFaqMatch(
      "O setor turístico de Poços de Caldas está evoluindo?",
      testFaqEntries
    );
    expect(match).toBeDefined();
    expect(match?.informationType).toBe("funcionarios_ao_longo_do_tempo");
  });

  it("retorna undefined quando não há match suficiente", () => {
    const match = findCuriosityFaqMatch(
      "Mostre funcionários por município em Pouso Alegre",
      testFaqEntries
    );
    expect(match).toBeUndefined();
  });

  it("retorna undefined para array de FAQ vazio", () => {
    const match = findCuriosityFaqMatch(
      "O setor turístico está evoluindo?",
      []
    );
    expect(match).toBeUndefined();
  });

  it("retorna undefined para FAQ undefined", () => {
    const match = findCuriosityFaqMatch(
      "O setor turístico está evoluindo?",
      undefined
    );
    expect(match).toBeUndefined();
  });

  it("faz match com variação da pergunta do FAQ", () => {
    const match = findCuriosityFaqMatch(
      "O turismo de Poços de Caldas está crescendo?",
      testFaqEntries
    );
    expect(match).toBeDefined();
    expect(match?.informationType).toBe("funcionarios_ao_longo_do_tempo");
  });
});
