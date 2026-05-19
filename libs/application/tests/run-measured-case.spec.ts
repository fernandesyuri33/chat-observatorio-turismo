import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  summarizeMeasuredResults,
  writeMeasuredResultsArtifacts,
  type MeasuredCaseResult,
} from "./support/run-measured-case";

const sampleResults: MeasuredCaseResult[] = [
  {
    dataset: "sample",
    name: "open url",
    message: "Mostre funcionários por município",
    actionType: "open_url",
    elapsedMs: 120,
    stage1Classification: "complete_show",
    stage1Confidence: 0.9,
    stage2InformationType: "funcionarios_por_municipio",
    stage2Confidence: 0.8,
    filters: {},
    passed: true,
    notes: [],
    action: {
      type: "open_url",
      url: "https://lookerstudio.google.com/embed/reporting/abc123/page/p_funcionarios_municipio",
    },
    actionSummary: {
      pathname: "/embed/reporting/abc123/page/p_funcionarios_municipio",
      params: null,
    },
    resolvedIntent: {
      intent: "show",
      informationType: "funcionarios_por_municipio",
      proposedFilters: {},
      confidence: 0.8,
      rationale: "Teste",
    },
  },
  {
    dataset: "sample",
    name: "fallback",
    message: "ajuda",
    actionType: "explain_only",
    elapsedMs: 80,
    stage1Classification: "initial_orientation",
    stage1Confidence: 0.7,
    stage2InformationType: undefined,
    stage2Confidence: undefined,
    filters: undefined,
    passed: false,
    notes: ["actionType fora do esperado"],
    action: {
      type: "explain_only",
      message: "Posso sugerir alguns caminhos de exploração:",
      suggestions: [
        "Comparar estabelecimentos entre municípios",
        "Visualizar a quantidade de funcionários por município",
      ],
    },
    actionSummary: {
      message: "Posso sugerir alguns caminhos de exploração:",
      suggestions: [
        "Comparar estabelecimentos entre municípios",
        "Visualizar a quantidade de funcionários por município",
      ],
    },
    resolvedIntent: {
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: 0.7,
      rationale: "Teste",
    },
  },
];

describe("runMeasuredCase helpers", () => {
  it("resume os resultados medidos", () => {
    const summary = summarizeMeasuredResults(sampleResults);

    expect(summary.totalCases).toBe(2);
    expect(summary.passedCases).toBe(1);
    expect(summary.failedCases).toBe(1);
    expect(summary.fallbackCases).toBe(1);
    expect(summary.averageElapsedMs).toBe(100);
    expect(summary.minElapsedMs).toBe(80);
    expect(summary.maxElapsedMs).toBe(120);
    expect(summary.actionTypeCounts).toEqual({
      open_url: 1,
      explain_only: 1,
    });
  });

  it("grava artefatos JSON para a avaliação real-LLM", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "run-measured-case-"));

    try {
      const artifact = await writeMeasuredResultsArtifacts(sampleResults, tempDir);

      await access(artifact.canonicalPath);
      await access(artifact.snapshotPath);

      expect(artifact.canonicalPath).toContain("real-llm-results.json");
      expect(artifact.snapshotPath).toContain("real-llm-results-");
      expect(artifact.summary.totalCases).toBe(2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});