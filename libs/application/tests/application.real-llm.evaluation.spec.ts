import { describe, expect, it } from "vitest";
import { PolicyEngine } from "@conversational/policy";
import { OllamaLlmAdapter, summarizeAssistantTurn, type ConversationTurn } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { PolicyConfig } from "@conversational/policy";
import type { ResolveDashboardActionDeps } from "../src/resolve-dashboard-action.usecase";
import {
  baseTestPolicyConfig,
} from "./resolve-dashboard-action.shared";
import {
  printMeasuredResultsTable,
  runMeasuredCase,
  writeMeasuredResultsArtifacts,
  type MeasuredCaseExpectation,
  type MeasuredCaseResult,
} from "./support/run-measured-case";

const runRealLlmTests = process.env["RUN_REAL_LLM_TESTS"] === "true";
const describeRealLlm = runRealLlmTests ? describe : describe.skip;
const datasetTimeout = 600_000;
const repetitionTimeout = 1_200_000;
const datasetFilter = process.env["REAL_LLM_EVAL_DATASET"]?.trim().toLocaleLowerCase("pt-BR");
const caseFilter = process.env["REAL_LLM_EVAL_CASE"]?.trim().toLocaleLowerCase("pt-BR");

type DatasetCase = {
  name: string;
  message: string;
  expected?: MeasuredCaseExpectation;
};

function matchesCaseFilter(testCase: DatasetCase): boolean {
  if (!caseFilter) {
    return true;
  }

  return testCase.name.toLocaleLowerCase("pt-BR").includes(caseFilter)
    || testCase.message.toLocaleLowerCase("pt-BR").includes(caseFilter);
}

function shouldRunDataset(dataset: string): boolean {
  if (!datasetFilter) {
    return true;
  }

  return dataset.toLocaleLowerCase("pt-BR") === datasetFilter;
}

function selectCases(dataset: string, cases: DatasetCase[]): DatasetCase[] {
  if (!shouldRunDataset(dataset)) {
    return [];
  }

  return cases.filter(matchesCaseFilter);
}

const fullCommandCases: DatasetCase[] = [
  {
    name: "estabelecimentos por município",
    message: "Mostre estabelecimentos por município",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
    },
  },
  {
    name: "funcionários por município",
    message: "Mostre funcionários por município",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
    },
  },
  {
    name: "funcionários ao longo do tempo",
    message: "Mostre funcionários ao longo do tempo",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
    },
  },
  {
    name: "saldo de funcionários ao longo do tempo",
    message: "Mostre saldo de funcionários ao longo do tempo",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
    },
  },
  {
    name: "estabelecimentos de hospedagem por município",
    message: "Mostre estabelecimentos de hospedagem por município",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários por município em Poços de Caldas",
    message: "Mostre funcionários por município em Poços de Caldas",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "estabelecimentos de alimentação em Pouso Alegre",
    message: "Mostre estabelecimentos de alimentação em Pouso Alegre",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Pouso Alegre",
      },
    },
  },
];

const contextualCases: DatasetCase[] = [
  {
    name: "dados de Poços de Caldas",
    message: "Quero ver dados de Poços de Caldas",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "interesse em hospedagem",
    message: "Tenho interesse em hospedagem",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "analisar alimentação",
    message: "Quero analisar alimentação",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "dados de Pouso Alegre",
    message: "Dados de Pouso Alegre",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
];

const initialOrientationCases: DatasetCase[] = [
  {
    name: "o que posso analisar",
    message: "O que posso analisar aqui?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
  {
    name: "informações disponíveis",
    message: "Quais informações estão disponíveis?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
  {
    name: "como o dashboard ajuda",
    message: "Como esse dashboard pode me ajudar?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
];

const curiosityCases: DatasetCase[] = [
  {
    name: "turismo de Poços de Caldas está crescendo",
    message: "O turismo de Poços de Caldas está crescendo?",
    expected: {
      allowedActionTypes: ["explain_only"],
      expectedSuggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
    },
  },
  {
    name: "setor turístico está evoluindo",
    message: "O setor turístico está evoluindo?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
  {
    name: "avaliar empregos no turismo",
    message: "Como posso avaliar empregos no turismo?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
];

const outOfScopeCases: DatasetCase[] = [
  {
    name: "visitantes por ano",
    message: "Mostre visitantes por ano",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "arrecadação de ISS",
    message: "Quero dados de arrecadação de ISS",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "previsão de demanda turística",
    message: "Mostre previsão de demanda turística",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "turistas estrangeiros por país",
    message: "Compare turistas estrangeiros por país",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
  {
    name: "dados de 2024",
    message: "Mostre dados de 2024",
    expected: { forbiddenActionTypes: ["open_url"] },
  },
];

const repeatedCommandCases: DatasetCase[] = [
  {
    name: "funcionários por município em Poços de Caldas",
    message: "Mostre funcionários por município em Poços de Caldas",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "estabelecimentos de hospedagem por município",
    message: "Mostre estabelecimentos de hospedagem por município",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários ao longo do tempo",
    message: "Mostre funcionários ao longo do tempo",
    expected: {
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
    },
  },
  {
    name: "o que posso analisar aqui",
    message: "O que posso analisar aqui?",
    expected: { allowedActionTypes: ["explain_only"] },
  },
  {
    name: "turismo de Poços de Caldas está crescendo",
    message: "O turismo de Poços de Caldas está crescendo?",
    expected: {
      allowedActionTypes: ["explain_only"],
      expectedSuggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
    },
  },
];

const selectedFullCommandCases = selectCases("comandos_completos", fullCommandCases);
const selectedContextualCases = selectCases("contextuais", contextualCases);
const selectedInitialOrientationCases = selectCases("orientacao_inicial", initialOrientationCases);
const selectedCuriosityCases = selectCases("curiosidades", curiosityCases);
const selectedOutOfScopeCases = selectCases("fora_de_escopo", outOfScopeCases);
const selectedRepeatedCommandCases = selectCases("repeticao", repeatedCommandCases);
const shouldRunMultiturn = shouldRunDataset("multiturno") && !caseFilter;

describeRealLlm("resolveDashboardAction (avaliação com LLM real)", () => {
  const collectedResults: MeasuredCaseResult[] = [];

  function buildDeps(overrideConfig?: Partial<PolicyConfig>): ResolveDashboardActionDeps {
    const config = { ...baseTestPolicyConfig, ...overrideConfig };
    const policyEngine = new PolicyEngine(config);
    const llm = new OllamaLlmAdapter();
    const provider = config.activeProvider === "custom"
      ? new CustomProvider()
      : new LookerProvider(config.looker);
    return { llm, policyEngine, provider };
  }

  async function measureDataset(dataset: string, cases: DatasetCase[]): Promise<MeasuredCaseResult[]> {
    const results: MeasuredCaseResult[] = [];

    for (const testCase of cases) {
      const result = await runMeasuredCase({
        dataset,
        name: testCase.name,
        message: testCase.message,
        deps: buildDeps(),
        expected: testCase.expected,
      });
      results.push(result);
      collectedResults.push(result);
    }

    return results;
  }

  function buildConversationHistory(
    previousMessage: string,
    previousResult: MeasuredCaseResult,
  ): ConversationTurn[] {
    const history: ConversationTurn[] = [
      { role: "user", content: previousMessage },
    ];

    if (previousResult.resolvedIntent) {
      history.push({
        role: "assistant",
        content: summarizeAssistantTurn(JSON.stringify(previousResult.resolvedIntent)),
      });
    }

    return history;
  }

  const itFullCommand = selectedFullCommandCases.length > 0 ? it : it.skip;
  const itContextual = selectedContextualCases.length > 0 ? it : it.skip;
  const itInitialOrientation = selectedInitialOrientationCases.length > 0 ? it : it.skip;
  const itCuriosity = selectedCuriosityCases.length > 0 ? it : it.skip;
  const itOutOfScope = selectedOutOfScopeCases.length > 0 ? it : it.skip;
  const itMultiturn = shouldRunMultiturn ? it : it.skip;
  const itRepeated = selectedRepeatedCommandCases.length > 0 ? it : it.skip;

  itFullCommand("mede o dataset de comandos completos", async () => {
    const results = await measureDataset("comandos_completos", selectedFullCommandCases);

    expect(results).toHaveLength(selectedFullCommandCases.length);
    expect(results.every((result) => result.elapsedMs >= 0)).toBe(true);
  }, datasetTimeout);

  itContextual("mede o dataset de comandos contextuais", async () => {
    const results = await measureDataset("contextuais", selectedContextualCases);

    expect(results).toHaveLength(selectedContextualCases.length);
    expect(results.every((result) => result.actionType.length > 0)).toBe(true);
  }, datasetTimeout);

  itInitialOrientation("mede o dataset de orientação inicial", async () => {
    const results = await measureDataset("orientacao_inicial", selectedInitialOrientationCases);

    expect(results).toHaveLength(selectedInitialOrientationCases.length);
    expect(results.every((result) => typeof result.stage1Classification === "string")).toBe(true);
  }, datasetTimeout);

  itCuriosity("mede o dataset de curiosidades", async () => {
    const results = await measureDataset("curiosidades", selectedCuriosityCases);

    expect(results).toHaveLength(selectedCuriosityCases.length);
    expect(results.every((result) => result.actionType.length > 0)).toBe(true);
  }, datasetTimeout);

  itOutOfScope("mede o dataset fora de escopo", async () => {
    const results = await measureDataset("fora_de_escopo", selectedOutOfScopeCases);

    expect(results).toHaveLength(selectedOutOfScopeCases.length);
    expect(results.every((result) => result.elapsedMs >= 0)).toBe(true);
  }, datasetTimeout);

  itMultiturn("mede cenários de múltiplos turnos com histórico", async () => {
    const firstScenarioDeps = buildDeps();
    const firstTurn = await runMeasuredCase({
      dataset: "multiturno",
      name: "turno 1 - funcionários por município em Poços de Caldas",
      message: "Mostre funcionários por município em Poços de Caldas",
      deps: firstScenarioDeps,
      expected: {
        allowedActionTypes: ["open_url"],
        expectedInformationType: "funcionarios_por_municipio",
        expectedFilters: { municipio: "Poços de Caldas" },
      },
    });
    collectedResults.push(firstTurn);

    const secondTurn = await runMeasuredCase({
      dataset: "multiturno",
      name: "turno 2 - agora de hospedagem",
      message: "Agora de hospedagem",
      deps: firstScenarioDeps,
      history: buildConversationHistory(
        "Mostre funcionários por município em Poços de Caldas",
        firstTurn,
      ),
      expected: {
        expectedInformationType: "funcionarios_por_municipio",
        expectedFilters: { classificacao: "hospedagem" },
      },
    });
    collectedResults.push(secondTurn);

    const thirdScenarioDeps = buildDeps();
    const thirdTurn = await runMeasuredCase({
      dataset: "multiturno",
      name: "turno 1 - estabelecimentos por município",
      message: "Mostre estabelecimentos por município",
      deps: thirdScenarioDeps,
      expected: {
        allowedActionTypes: ["open_url"],
        expectedInformationType: "estabelecimentos_por_municipio",
      },
    });
    collectedResults.push(thirdTurn);

    const fourthTurn = await runMeasuredCase({
      dataset: "multiturno",
      name: "turno 2 - agora em Pouso Alegre",
      message: "Agora em Pouso Alegre",
      deps: thirdScenarioDeps,
      history: buildConversationHistory(
        "Mostre estabelecimentos por município",
        thirdTurn,
      ),
      expected: {
        expectedInformationType: "estabelecimentos_por_municipio",
        expectedFilters: { municipio: "Pouso Alegre" },
      },
    });
    collectedResults.push(fourthTurn);

    expect([firstTurn, secondTurn, thirdTurn, fourthTurn]).toHaveLength(4);
  }, datasetTimeout);

  itRepeated("mede repetição dos comandos principais", async () => {
    const repeatedResults: MeasuredCaseResult[] = [];

    for (const testCase of selectedRepeatedCommandCases) {
      for (let runIndex = 1; runIndex <= 3; runIndex += 1) {
        const result = await runMeasuredCase({
          dataset: "repeticao",
          name: `${testCase.name} (execução ${runIndex})`,
          message: testCase.message,
          deps: buildDeps(),
          expected: testCase.expected,
        });
        repeatedResults.push(result);
        collectedResults.push(result);
      }
    }

    expect(repeatedResults).toHaveLength(selectedRepeatedCommandCases.length * 3);
  }, repetitionTimeout);

  it("gera o artefato JSON e imprime um resumo tabular", async () => {
    expect(collectedResults.length).toBeGreaterThan(0);

    printMeasuredResultsTable(collectedResults);
    const artifact = await writeMeasuredResultsArtifacts(collectedResults);

    expect(artifact.summary.totalCases).toBe(collectedResults.length);
    expect(artifact.canonicalPath).toContain("artifacts/real-llm-results.json");
    expect(artifact.snapshotPath).toContain("artifacts/real-llm-results-");
  }, 30_000);
});