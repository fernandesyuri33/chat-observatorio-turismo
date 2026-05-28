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
const datasetTimeout = 28_800_000;
const repetitionTimeout = 28_800_000;
const datasetFilter = process.env["REAL_LLM_EVAL_DATASET"]?.trim().toLocaleLowerCase("pt-BR");
const caseFilter = process.env["REAL_LLM_EVAL_CASE"]?.trim().toLocaleLowerCase("pt-BR");
const percentageFilter = parseEvalPercentage(process.env["REAL_LLM_EVAL_PERCENTAGE"]?.trim());

type DatasetCase = {
  name: string;
  message: string;
  expected?: MeasuredCaseExpectation;
};

type MultiTurnDatasetCase = DatasetCase & {
  history: ConversationTurn[];
};

type HistoryResolvedIntent = {
  intent: "show";
  informationType: string;
  proposedFilters: Record<string, unknown>;
  confidence?: number;
  rationale?: string;
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

function selectCases<T extends DatasetCase>(dataset: string, cases: T[]): T[] {
  if (!shouldRunDataset(dataset)) {
    return [];
  }

  return cases.filter(matchesCaseFilter);
}

function parseEvalPercentage(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.replace(",", ".");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("REAL_LLM_EVAL_PERCENTAGE deve ser um número válido entre 0 e 100.");
  }

  if (parsedValue < 0 || parsedValue > 100) {
    throw new Error("REAL_LLM_EVAL_PERCENTAGE deve estar no intervalo de 0 a 100.");
  }

  return parsedValue;
}

function selectCasesByPercentage<T extends DatasetCase>(dataset: string, cases: T[]): T[] {
  const selectedCases = selectCases(dataset, cases);

  if (percentageFilter === undefined) {
    return selectedCases;
  }

  if (percentageFilter === 0 || selectedCases.length === 0) {
    return [];
  }

  const selectedCount = Math.ceil((selectedCases.length * percentageFilter) / 100);
  return selectedCases.slice(0, selectedCount);
}

function createConversationHistory(
  previousMessage: string,
  resolvedIntent: HistoryResolvedIntent,
): ConversationTurn[] {
  return [
    { role: "user", content: previousMessage },
    {
      role: "assistant",
      content: summarizeAssistantTurn(
        JSON.stringify({
          intent: resolvedIntent.intent,
          informationType: resolvedIntent.informationType,
          proposedFilters: resolvedIntent.proposedFilters,
          confidence: resolvedIntent.confidence ?? 1,
          rationale: resolvedIntent.rationale,
        }),
      ),
    },
  ];
}

function createMultiTurnCase(input: {
  name: string;
  message: string;
  previousMessage: string;
  previousIntent: HistoryResolvedIntent;
  expected: MeasuredCaseExpectation;
}): MultiTurnDatasetCase {
  return {
    name: input.name,
    message: input.message,
    history: createConversationHistory(input.previousMessage, input.previousIntent),
    expected: {
      allowedActionTypes: ["open_url"],
      ...input.expected,
    },
  };
}

const fullCommandCases: DatasetCase[] = [
  // ===== estabelecimentos_por_municipio =====
  {
    name: "estabelecimentos por município - sem filtros (v1)",
    message: "Mostre estabelecimentos por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectNoFilters: true,
    },
  },
  {
    name: "estabelecimentos por município - sem filtros (v2)",
    message: "Quero ver todos os estabelecimentos por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectNoFilters: true,
    },
  },
  {
    name: "estabelecimentos por município - sem filtros (v3)",
    message: "Exiba os estabelecimentos distribuídos por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectNoFilters: true,
    },
  },
  {
    name: "estabelecimentos de alimentação por município (v1)",
    message: "Mostre estabelecimentos de alimentação por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "estabelecimentos de alimentação por município (v2)",
    message: "Quero ver onde estão os restaurantes e bares por cidade",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "estabelecimentos de alimentação por município (v3)",
    message: "Dados de estabelecimentos de alimentação distribuídos nos municípios",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "estabelecimentos de hospedagem por município (v1)",
    message: "Mostre estabelecimentos de hospedagem por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "estabelecimentos de hospedagem por município (v2)",
    message: "Quantos hotéis e pousadas tem em cada cidade?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "estabelecimentos de hospedagem por município (v3)",
    message: "Me mostra onde estão as hospedarias distribuídas por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "estabelecimentos de transportes por município (v1)",
    message: "Mostre estabelecimentos de transportes por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "estabelecimentos de transportes por município (v2)",
    message: "Quantas empresas de transporte atuam em cada município?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "estabelecimentos em Poços de Caldas (v1)",
    message: "Mostre estabelecimentos em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "estabelecimentos em Poços de Caldas (v2)",
    message: "Quero saber quais negócios tem em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "estabelecimentos em Pouso Alegre (v1)",
    message: "Mostre estabelecimentos em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "estabelecimentos em Pouso Alegre (v2)",
    message: "Me mostra os negócios de Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "estabelecimentos em Divinópolis (v1)",
    message: "Mostre estabelecimentos em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "estabelecimentos em Divinópolis (v2)",
    message: "Dados de estabelecimentos em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "estabelecimentos de alimentação em Poços de Caldas (v1)",
    message: "Mostre estabelecimentos de alimentação em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de alimentação em Poços de Caldas (v2)",
    message: "Quantos restaurantes tem em Poços de Caldas?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de alimentação em Pouso Alegre (v1)",
    message: "Mostre estabelecimentos de alimentação em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de alimentação em Pouso Alegre (v2)",
    message: "Me mostra onde comer em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de alimentação em Divinópolis (v1)",
    message: "Mostre estabelecimentos de alimentação em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "estabelecimentos de alimentação em Divinópolis (v2)",
    message: "Dados de restaurantes e bares em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Poços de Caldas (v1)",
    message: "Mostre estabelecimentos de hospedagem em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Poços de Caldas (v2)",
    message: "Onde ficar em Poços de Caldas? Quantas opções têm?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Pouso Alegre (v1)",
    message: "Mostre estabelecimentos de hospedagem em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Pouso Alegre (v2)",
    message: "Hotéis e pousadas em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Divinópolis (v1)",
    message: "Mostre estabelecimentos de hospedagem em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "estabelecimentos de hospedagem em Divinópolis (v2)",
    message: "Hospedarias em Divinópolis - lista completa",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Poços de Caldas (v1)",
    message: "Mostre estabelecimentos de transportes em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Poços de Caldas (v2)",
    message: "Transporte e logística em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Pouso Alegre (v1)",
    message: "Mostre estabelecimentos de transportes em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Pouso Alegre (v2)",
    message: "Empresas de transporte em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Divinópolis (v1)",
    message: "Mostre estabelecimentos de transportes em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "estabelecimentos de transportes em Divinópolis (v2)",
    message: "Transportadoras e logística em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },

  // ===== funcionarios_por_municipio =====
  {
    name: "funcionários por município - sem filtros (v1)",
    message: "Mostre funcionários por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectNoFilters: true,
    },
  },
  {
    name: "funcionários por município - sem filtros (v2)",
    message: "Quantos funcionários trabalham em cada cidade?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectNoFilters: true,
    },
  },
  {
    name: "funcionários de alimentação por município (v1)",
    message: "Mostre funcionários de alimentação por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "funcionários de alimentação por município (v2)",
    message: "Quantos funcionários o setor de alimentação tem em cada município?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "funcionários de hospedagem por município (v1)",
    message: "Mostre funcionários de hospedagem por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários de hospedagem por município (v2)",
    message: "Mão de obra no setor hoteleiro por cidade",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários de transportes por município (v1)",
    message: "Mostre funcionários de transportes por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "funcionários de transportes por município (v2)",
    message: "Empregos em transportes por cidade",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "funcionários em Poços de Caldas (v1)",
    message: "Mostre funcionários em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "funcionários em Poços de Caldas (v2)",
    message: "Quantas pessoas trabalham em Poços de Caldas?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "funcionários em Pouso Alegre (v1)",
    message: "Mostre funcionários em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "funcionários em Pouso Alegre (v2)",
    message: "Dados de emprego em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "funcionários em Divinópolis (v1)",
    message: "Mostre funcionários em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "funcionários em Divinópolis (v2)",
    message: "Força de trabalho em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "funcionários de alimentação em Poços de Caldas (v1)",
    message: "Mostre funcionários de alimentação em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de alimentação em Poços de Caldas (v2)",
    message: "Pessoal que trabalha com alimentação em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de alimentação em Pouso Alegre (v1)",
    message: "Mostre funcionários de alimentação em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de alimentação em Pouso Alegre (v2)",
    message: "Empregos em restaurantes e bares - Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de alimentação em Divinópolis (v1)",
    message: "Mostre funcionários de alimentação em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de alimentação em Divinópolis (v2)",
    message: "Setor alimentício - empregos em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Poços de Caldas (v1)",
    message: "Mostre funcionários de hospedagem em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Poços de Caldas (v2)",
    message: "Quantos trabalham na hotelaria em Poços de Caldas?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Pouso Alegre (v1)",
    message: "Mostre funcionários de hospedagem em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Pouso Alegre (v2)",
    message: "Hotéis e pousadas - mercado de trabalho em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Divinópolis (v1)",
    message: "Mostre funcionários de hospedagem em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Divinópolis (v2)",
    message: "Empregos na hospedagem - Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de transportes em Poços de Caldas (v1)",
    message: "Mostre funcionários de transportes em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de transportes em Poços de Caldas (v2)",
    message: "Trabalho no transporte - Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de transportes em Pouso Alegre (v1)",
    message: "Mostre funcionários de transportes em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de transportes em Pouso Alegre (v2)",
    message: "Logística e transportes - empregos em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de transportes em Divinópolis (v1)",
    message: "Mostre funcionários de transportes em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de transportes em Divinópolis (v2)",
    message: "Setor de transporte - força de trabalho em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },

  // ===== funcionarios_ao_longo_do_tempo =====
  {
    name: "funcionários ao longo do tempo - sem filtros (v1)",
    message: "Mostre funcionários ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectNoFilters: true,
    },
  },
  {
    name: "funcionários ao longo do tempo - sem filtros (v2)",
    message: "Como o emprego evoluiu ao longo dos anos?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectNoFilters: true,
    },
  },
  {
    name: "funcionários de alimentação ao longo do tempo (v1)",
    message: "Mostre funcionários de alimentação ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "funcionários de alimentação ao longo do tempo (v2)",
    message: "Evolução do setor de alimentação nos últimos anos",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "funcionários de hospedagem ao longo do tempo (v1)",
    message: "Mostre funcionários de hospedagem ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários de hospedagem ao longo do tempo (v2)",
    message: "Como cresceu o turismo (mercado hoteleiro) ao longo do tempo?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários de transportes ao longo do tempo (v1)",
    message: "Mostre funcionários de transportes ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "funcionários de transportes ao longo do tempo (v2)",
    message: "Tendência de empregos em transporte ao longo dos anos",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "funcionários em Poços de Caldas ao longo do tempo (v1)",
    message: "Mostre funcionários em Poços de Caldas ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "funcionários em Poços de Caldas ao longo do tempo (v2)",
    message: "Evolução do emprego em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "funcionários em Pouso Alegre ao longo do tempo (v1)",
    message: "Mostre funcionários em Pouso Alegre ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "funcionários em Pouso Alegre ao longo do tempo (v2)",
    message: "Série histórica de emprego em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "funcionários em Divinópolis ao longo do tempo (v1)",
    message: "Mostre funcionários em Divinópolis ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "funcionários em Divinópolis ao longo do tempo (v2)",
    message: "Crescimento de empregos em Divinópolis - série temporal",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "funcionários de alimentação em Poços de Caldas ao longo do tempo (v1)",
    message: "Mostre funcionários de alimentação em Poços de Caldas ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de alimentação em Poços de Caldas ao longo do tempo (v2)",
    message: "Como evoluiu o setor de alimentação em Poços de Caldas?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Pouso Alegre ao longo do tempo (v1)",
    message: "Mostre funcionários de hospedagem em Pouso Alegre ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de hospedagem em Pouso Alegre ao longo do tempo (v2)",
    message: "Crescimento do turismo em Pouso Alegre - série histórica",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "funcionários de transportes em Divinópolis ao longo do tempo (v1)",
    message: "Mostre funcionários de transportes em Divinópolis ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "funcionários de transportes em Divinópolis ao longo do tempo (v2)",
    message: "Trajetória de empregos em transporte - Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },

  // ===== saldo_funcionarios_ao_longo_do_tempo =====
  {
    name: "saldo de funcionários ao longo do tempo - sem filtros (v1)",
    message: "Mostre saldo de funcionários ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectNoFilters: true,
    },
  },
  {
    name: "saldo de funcionários ao longo do tempo - sem filtros (v2)",
    message: "Qual foi o saldo de criação de empregos ao longo dos anos?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectNoFilters: true,
    },
  },
  {
    name: "saldo de funcionários de alimentação ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de alimentação ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "saldo de funcionários de alimentação ao longo do tempo (v2)",
    message: "Balanço de empregos no setor de alimentação",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "alimentação" },
    },
  },
  {
    name: "saldo de funcionários de hospedagem ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de hospedagem ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "saldo de funcionários de hospedagem ao longo do tempo (v2)",
    message: "Quantos empregos foram criados no turismo?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "saldo de funcionários de transportes ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de transportes ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "saldo de funcionários de transportes ao longo do tempo (v2)",
    message: "Empregos ganhos ou perdidos em transportes?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "transportes" },
    },
  },
  {
    name: "saldo de funcionários em Poços de Caldas ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários em Poços de Caldas ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "saldo de funcionários em Poços de Caldas ao longo do tempo (v2)",
    message: "Balanço de empregos em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "saldo de funcionários em Pouso Alegre ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários em Pouso Alegre ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "saldo de funcionários em Pouso Alegre ao longo do tempo (v2)",
    message: "Saldo de novos empregos em Pouso Alegre",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Pouso Alegre" },
    },
  },
  {
    name: "saldo de funcionários em Divinópolis ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários em Divinópolis ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "saldo de funcionários em Divinópolis ao longo do tempo (v2)",
    message: "Variação de empregos em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Divinópolis" },
    },
  },
  {
    name: "saldo de funcionários de alimentação em Poços de Caldas ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de alimentação em Poços de Caldas ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "saldo de funcionários de alimentação em Poços de Caldas ao longo do tempo (v2)",
    message: "O setor de alimentação cresceu em Poços de Caldas?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "alimentação",
        municipio: "Poços de Caldas",
      },
    },
  },
  {
    name: "saldo de funcionários de hospedagem em Pouso Alegre ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de hospedagem em Pouso Alegre ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "saldo de funcionários de hospedagem em Pouso Alegre ao longo do tempo (v2)",
    message: "Turismo está gerando mais empregos em Pouso Alegre?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "hospedagem",
        municipio: "Pouso Alegre",
      },
    },
  },
  {
    name: "saldo de funcionários de transportes em Divinópolis ao longo do tempo (v1)",
    message: "Mostre saldo de funcionários de transportes em Divinópolis ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },
  {
    name: "saldo de funcionários de transportes em Divinópolis ao longo do tempo (v2)",
    message: "Mercado de transporte - saldo de empregos em Divinópolis",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: {
        classificacao: "transportes",
        municipio: "Divinópolis",
      },
    },
  },
];

const contextualCases: DatasetCase[] = [
  {
    name: "dados de Poços de Caldas",
    message: "Quero ver dados de Poços de Caldas",
    expected: {
      expectedStage1Classification: "context_only",
      forbiddenActionTypes: ["open_url"],
    },
  },
  {
    name: "interesse em hospedagem",
    message: "Tenho interesse em hospedagem",
    expected: {
      expectedStage1Classification: "context_only",
      forbiddenActionTypes: ["open_url"],
    },
  },
  {
    name: "analisar alimentação",
    message: "Quero analisar alimentação",
    expected: {
      expectedStage1Classification: "context_only",
      forbiddenActionTypes: ["open_url"],
    },
  },
  {
    name: "dados de Pouso Alegre",
    message: "Dados de Pouso Alegre",
    expected: {
      expectedStage1Classification: "context_only",
      forbiddenActionTypes: ["open_url"],
    },
  },
];

const initialOrientationCases: DatasetCase[] = [
  {
    name: "o que posso analisar",
    message: "O que posso analisar aqui?",
    expected: {
      expectedStage1Classification: "initial_orientation",
      allowedActionTypes: ["explain_only"],
    },
  },
  {
    name: "informações disponíveis",
    message: "Quais informações estão disponíveis?",
    expected: {
      expectedStage1Classification: "initial_orientation",
      allowedActionTypes: ["explain_only"],
    },
  },
  {
    name: "como o dashboard ajuda",
    message: "Como esse dashboard pode me ajudar?",
    expected: {
      expectedStage1Classification: "initial_orientation",
      allowedActionTypes: ["explain_only"],
    },
  },
];

const curiosityCases: DatasetCase[] = [
  {
    name: "turismo de Poços de Caldas está crescendo",
    message: "O turismo de Poços de Caldas está crescendo?",
    expected: {
      expectedStage1Classification: "curiosity_to_action",
      allowedActionTypes: ["explain_only"],
      expectedSuggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
    },
  },
  {
    name: "setor turístico está evoluindo",
    message: "O setor turístico está evoluindo?",
    expected: {
      expectedStage1Classification: "curiosity_to_action",
      allowedActionTypes: ["explain_only"],
    },
  },
  {
    name: "avaliar empregos no turismo",
    message: "Como posso avaliar empregos no turismo?",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
    },
  },
];

const outOfScopeCases: DatasetCase[] = [
  {
    name: "visitantes por ano",
    message: "Mostre visitantes por ano",
    expected: { 
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"] 
    },
  },
  {
    name: "arrecadação de ISS",
    message: "Quero dados de arrecadação de ISS",
    expected: { 
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"] 
    },
  },
  {
    name: "previsão de demanda turística",
    message: "Mostre previsão de demanda turística",
    expected: { 
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"] 
    },
  },
  {
    name: "turistas estrangeiros por país",
    message: "Compare turistas estrangeiros por país",
    expected: { 
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"] 
    },
  },
  {
    name: "dados de 2024",
    message: "Mostre dados de 2024",
    expected: { 
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"] 
    },
  },
];

const repeatedCommandCases: DatasetCase[] = [
  {
    name: "funcionários por município em Poços de Caldas",
    message: "Mostre funcionários por município em Poços de Caldas",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { municipio: "Poços de Caldas" },
    },
  },
  {
    name: "estabelecimentos de hospedagem por município",
    message: "Mostre estabelecimentos de hospedagem por município",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
    },
  },
  {
    name: "funcionários ao longo do tempo",
    message: "Mostre funcionários ao longo do tempo",
    expected: {
      expectedStage1Classification: "complete_show",
      allowedActionTypes: ["open_url"],
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectNoFilters: true,
    },
  },
  {
    name: "o que posso analisar aqui",
    message: "O que posso analisar aqui?",
    expected: { 
      expectedStage1Classification: "initial_orientation",
      allowedActionTypes: ["explain_only"] 
    },
  },
  {
    name: "turismo de Poços de Caldas está crescendo",
    message: "O turismo de Poços de Caldas está crescendo?",
    expected: {
      expectedStage1Classification: "curiosity_to_action",
      allowedActionTypes: ["explain_only"],
      expectedSuggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
    },
  },
];

const minimumDatasetCaseCount = 50;

function createContextOnlyCase(name: string, message: string): DatasetCase {
  return {
    name,
    message,
    expected: {
      expectedStage1Classification: "context_only",
      forbiddenActionTypes: ["open_url"],
    },
  };
}

function createInitialOrientationCase(name: string, message: string): DatasetCase {
  return {
    name,
    message,
    expected: {
      expectedStage1Classification: "initial_orientation",
      allowedActionTypes: ["explain_only"],
    },
  };
}

function createCuriosityCase(name: string, message: string): DatasetCase {
  return {
    name,
    message,
    expected: {
      expectedStage1Classification: "curiosity_to_action",
      allowedActionTypes: ["explain_only"],
      forbiddenActionTypes: ["open_url"],
    },
  };
}

function createOutOfScopeCase(name: string, message: string): DatasetCase {
  return {
    name,
    message,
    expected: {
      expectedStage1Classification: "unclear",
      forbiddenActionTypes: ["open_url"],
    },
  };
}

const contextualCasesGenerated: DatasetCase[] = [
  "Quero dados de Alfenas",
  "Quero dados de Araxá",
  "Quero dados de Itajubá",
  "Quero dados de Juiz de Fora",
  "Quero dados de Montes Claros",
  "Quero dados de Uberaba",
  "Quero dados de Uberlândia",
  "Quero dados de Varginha",
  "Tenho interesse no setor de alimentação",
  "Tenho interesse no setor de hospedagem",
  "Tenho interesse no setor de transportes",
  "Tenho interesse no setor de entretenimento",
  "Tenho interesse no setor de comércios e serviços",
  "Tenho interesse no setor de agências e operadores",
  "Dados de alimentação em Minas Gerais",
  "Dados de hospedagem em Minas Gerais",
  "Dados de transportes em Minas Gerais",
  "Quero contexto de alimentação para Poços de Caldas",
  "Quero contexto de alimentação para Pouso Alegre",
  "Quero contexto de alimentação para Divinópolis",
  "Quero contexto de hospedagem para Poços de Caldas",
  "Quero contexto de hospedagem para Pouso Alegre",
  "Quero contexto de hospedagem para Divinópolis",
  "Quero contexto de transportes para Poços de Caldas",
  "Quero contexto de transportes para Pouso Alegre",
  "Quero contexto de transportes para Divinópolis",
  "Cenário de Poços de Caldas",
  "Cenário de Pouso Alegre",
  "Cenário de Divinópolis",
  "Contexto municipal de Poços de Caldas",
  "Contexto municipal de Pouso Alegre",
  "Contexto municipal de Divinópolis",
  "Panorama de alimentação em Poços de Caldas",
  "Panorama de alimentação em Pouso Alegre",
  "Panorama de alimentação em Divinópolis",
  "Panorama de hospedagem em Poços de Caldas",
  "Panorama de hospedagem em Pouso Alegre",
  "Panorama de hospedagem em Divinópolis",
  "Panorama de transportes em Poços de Caldas",
  "Panorama de transportes em Pouso Alegre",
  "Panorama de transportes em Divinópolis",
  "Meu foco é hospedagem",
  "Meu foco é alimentação",
  "Meu foco é transportes",
  "Meu foco é entretenimento",
  "Meu foco é comércios e serviços",
].map((message, index) => createContextOnlyCase(`contextual adicional ${index + 1}`, message));

const initialOrientationCasesGenerated: DatasetCase[] = [
  "Que tipo de análise eu consigo fazer neste dashboard?",
  "Como começo a usar este painel de turismo e emprego?",
  "Quais perguntas esse sistema consegue responder?",
  "Que recortes estão disponíveis para consulta?",
  "Quais opções de análise por município eu tenho?",
  "Como explorar os dados disponíveis no painel?",
  "Quais temas de informação eu posso investigar?",
  "Você pode me orientar sobre os tipos de análise?",
  "Antes de tudo, o que dá para analisar aqui?",
  "Quais indicadores este dashboard cobre?",
  "Qual é o escopo de análise deste painel?",
  "Que informações de turismo estão disponíveis para consulta?",
  "Quais análises de estabelecimentos posso pedir?",
  "Quais análises de funcionários posso pedir?",
  "O que eu posso descobrir neste dashboard?",
  "Quais caminhos de análise você recomenda para começar?",
  "Como faço uma primeira análise neste sistema?",
  "Você pode explicar o que esse dashboard oferece?",
  "Quais visões de dados estão habilitadas?",
  "Que consultas são suportadas aqui?",
  "Quais comparações este painel permite?",
  "Como posso navegar pelas informações disponíveis?",
  "Quais perguntas iniciais fazem sentido neste dashboard?",
  "Que tipo de resultado eu consigo extrair daqui?",
  "Quais dimensões de análise estão disponíveis?",
  "Quais recortes temporais eu posso usar?",
  "Que análises por classificação estão disponíveis?",
  "Como esse painel organiza os dados de turismo?",
  "Como esse painel organiza os dados de emprego?",
  "O que você consegue mostrar nesse dashboard?",
  "Quais painéis ou visualizações posso abrir?",
  "Que análises são possíveis sem filtro?",
  "Que análises são possíveis por município?",
  "Que análises são possíveis por setor?",
  "Pode resumir as possibilidades de análise deste painel?",
  "Quais informações principais posso consultar agora?",
  "Qual é o melhor ponto de partida para analisar esses dados?",
  "Que tipos de perguntas funcionam bem aqui?",
  "Como eu poderia começar uma análise exploratória aqui?",
  "Quais análises históricas este dashboard suporta?",
  "Quais análises de saldo de empregos estão disponíveis?",
  "Quais análises de evolução de funcionários estão disponíveis?",
  "Quais dados por município estão disponíveis?",
  "Quais dados por classificação de atividade estão disponíveis?",
  "Que tipo de apoio você dá para orientar uma análise?",
  "Quais orientações iniciais você pode me dar sobre este dashboard?",
  "Pode explicar as capacidades do sistema antes de eu pedir um recorte?",
].map((message, index) => createInitialOrientationCase(`orientação inicial adicional ${index + 1}`, message));

const curiosityCasesGenerated: DatasetCase[] = [
  "O turismo em Poços de Caldas está melhorando nos últimos anos?",
  "O turismo em Pouso Alegre está melhorando nos últimos anos?",
  "O turismo em Divinópolis está melhorando nos últimos anos?",
  "O setor de hospedagem em Poços de Caldas está aquecido?",
  "O setor de hospedagem em Pouso Alegre está aquecido?",
  "O setor de hospedagem em Divinópolis está aquecido?",
  "O setor de alimentação em Poços de Caldas está ganhando força?",
  "O setor de alimentação em Pouso Alegre está ganhando força?",
  "O setor de alimentação em Divinópolis está ganhando força?",
  "O setor de transportes em Poços de Caldas está se expandindo?",
  "O setor de transportes em Pouso Alegre está se expandindo?",
  "O setor de transportes em Divinópolis está se expandindo?",
  "Há sinais de crescimento do turismo em Poços de Caldas?",
  "Há sinais de crescimento do turismo em Pouso Alegre?",
  "Há sinais de crescimento do turismo em Divinópolis?",
  "O mercado turístico de Poços de Caldas está em alta?",
  "O mercado turístico de Pouso Alegre está em alta?",
  "O mercado turístico de Divinópolis está em alta?",
  "A hotelaria de Poços de Caldas está criando mais empregos?",
  "A hotelaria de Pouso Alegre está criando mais empregos?",
  "A hotelaria de Divinópolis está criando mais empregos?",
  "A alimentação em Poços de Caldas vem crescendo?",
  "A alimentação em Pouso Alegre vem crescendo?",
  "A alimentação em Divinópolis vem crescendo?",
  "Os transportes em Poços de Caldas têm evoluído?",
  "Os transportes em Pouso Alegre têm evoluído?",
  "Os transportes em Divinópolis têm evoluído?",
  "O turismo mineiro dá sinais de recuperação?",
  "Será que a hospedagem tem avançado recentemente?",
  "Será que o setor alimentício está em crescimento?",
  "Você diria que o turismo regional está avançando?",
  "O emprego no turismo está melhorando na região?",
  "Existe tendência positiva no turismo de Poços de Caldas?",
  "Existe tendência positiva no turismo de Pouso Alegre?",
  "Existe tendência positiva no turismo de Divinópolis?",
  "A dinâmica de empregos no turismo parece favorável?",
  "A evolução da hotelaria sugere crescimento?",
  "A evolução de alimentação sugere crescimento?",
  "A evolução de transportes sugere crescimento?",
  "O cenário turístico aponta expansão em Poços de Caldas?",
  "O cenário turístico aponta expansão em Pouso Alegre?",
  "O cenário turístico aponta expansão em Divinópolis?",
  "A atividade turística está mais forte neste período?",
  "Há indícios de melhora no emprego turístico?",
  "Turismo e emprego estão evoluindo na mesma direção?",
  "A tendência recente do turismo parece positiva?",
  "Você consegue indicar se o turismo está em trajetória de alta?",
].map((message, index) => createCuriosityCase(`curiosidade adicional ${index + 1}`, message));

const outOfScopeCasesGenerated: DatasetCase[] = [
  "Mostre número de turistas estrangeiros por país",
  "Quero previsão de fluxo de visitantes para o próximo ano",
  "Mostre taxa de ocupação hoteleira por mês",
  "Compare gasto médio por turista em cada cidade",
  "Quero dados de arrecadação de ICMS",
  "Mostre inflação municipal nos últimos anos",
  "Quero dados de PIB por município",
  "Mostre taxa de câmbio do dólar por ano",
  "Compare preço médio de diárias de hotéis",
  "Mostre volume de passageiros em aeroportos",
  "Quero dados de crimes por bairro",
  "Mostre número de leitos hospitalares por município",
  "Quero taxa de vacinação por cidade",
  "Mostre desempenho escolar por município",
  "Quero dados de consumo de energia residencial",
  "Mostre dados de trânsito e acidentes por rodovia",
  "Quero mapa de chuvas por município",
  "Mostre temperatura média anual das cidades",
  "Quero ranking de universidades por cidade",
  "Mostre dados de exportação por setor",
  "Quero dados de importação por município",
  "Mostre arrecadação de IPTU por cidade",
  "Quero gastos públicos com saúde por município",
  "Mostre orçamento da educação municipal",
  "Quero número de matrículas escolares por ano",
  "Mostre natalidade e mortalidade por município",
  "Quero índice de desenvolvimento humano por cidade",
  "Mostre preço médio da cesta básica por município",
  "Quero valor do metro quadrado por cidade",
  "Mostre mercado imobiliário por bairro",
  "Quero dados de frota de veículos por tipo",
  "Mostre consumo de combustíveis por município",
  "Quero receita de pedágio por rodovia",
  "Mostre produção agrícola por cultura",
  "Quero dados de pecuária por município",
  "Mostre balança comercial do estado",
  "Quero estatísticas de população por faixa etária",
  "Mostre migração entre municípios",
  "Quero número de nascimentos por hospital",
  "Mostre cobertura de saneamento por bairro",
  "Quero qualidade da água por município",
  "Mostre qualidade do ar por cidade",
  "Quero emissões de carbono por setor",
  "Mostre dados de internet banda larga por bairro",
  "Quero cobertura de telefonia móvel por cidade",
].map((message, index) => createOutOfScopeCase(`fora de escopo adicional ${index + 1}`, message));

const repeatedCommandCasesGenerated: DatasetCase[] = fullCommandCases
  .slice(0, 45)
  .map((testCase, index) => ({
    ...testCase,
    name: `repetição adicional ${index + 1} - ${testCase.name}`,
  }));

const multiturnCases: MultiTurnDatasetCase[] = [
  ...[
    {
      previousMessage: "Mostre funcionários por município",
      informationType: "funcionarios_por_municipio",
    },
    {
      previousMessage: "Mostre estabelecimentos por município",
      informationType: "estabelecimentos_por_municipio",
    },
    {
      previousMessage: "Mostre funcionários ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
    },
    {
      previousMessage: "Mostre saldo de funcionários ao longo do tempo",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
    },
  ].flatMap(({ previousMessage, informationType }) => [
    createMultiTurnCase({
      name: `${informationType} -> agora em Poços de Caldas`,
      message: "Agora em Poços de Caldas",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Poços de Caldas" },
      },
    }),
    createMultiTurnCase({
      name: `${informationType} -> agora em Pouso Alegre`,
      message: "Agora em Pouso Alegre",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Pouso Alegre" },
      },
    }),
    createMultiTurnCase({
      name: `${informationType} -> agora em Divinópolis`,
      message: "Agora em Divinópolis",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Divinópolis" },
      },
    }),
  ]),
  ...[
    {
      previousMessage: "Mostre estabelecimentos de alimentação por município",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: { classificacao: "alimentação" },
    },
    {
      previousMessage: "Mostre estabelecimentos de hospedagem por município",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: { classificacao: "hospedagem" },
    },
    {
      previousMessage: "Mostre funcionários de transportes por município",
      informationType: "funcionarios_por_municipio",
      proposedFilters: { classificacao: "transportes" },
    },
    {
      previousMessage: "Mostre funcionários de alimentação ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
      proposedFilters: { classificacao: "alimentação" },
    },
    {
      previousMessage: "Mostre saldo de funcionários de hospedagem ao longo do tempo",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
      proposedFilters: { classificacao: "hospedagem" },
    },
  ].flatMap(({ previousMessage, informationType, proposedFilters }) => [
    createMultiTurnCase({
      name: `${informationType} com classificação -> agora em Poços de Caldas`,
      message: "Agora em Poços de Caldas",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Poços de Caldas" },
        allowAdditionalFilters: true,
      },
    }),
    createMultiTurnCase({
      name: `${informationType} com classificação -> agora em Pouso Alegre`,
      message: "Agora em Pouso Alegre",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Pouso Alegre" },
        allowAdditionalFilters: true,
      },
    }),
    createMultiTurnCase({
      name: `${informationType} com classificação -> agora em Divinópolis`,
      message: "Agora em Divinópolis",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { municipio: "Divinópolis" },
        allowAdditionalFilters: true,
      },
    }),
  ]),
  ...[
    {
      previousMessage: "Mostre funcionários por município em Poços de Caldas",
      informationType: "funcionarios_por_municipio",
      proposedFilters: { municipio: "Poços de Caldas" },
    },
    {
      previousMessage: "Mostre funcionários por município em Pouso Alegre",
      informationType: "funcionarios_por_municipio",
      proposedFilters: { municipio: "Pouso Alegre" },
    },
    {
      previousMessage: "Mostre estabelecimentos por município em Divinópolis",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: { municipio: "Divinópolis" },
    },
    {
      previousMessage: "Mostre funcionários em Poços de Caldas ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
      proposedFilters: { municipio: "Poços de Caldas" },
    },
    {
      previousMessage: "Mostre saldo de funcionários em Pouso Alegre ao longo do tempo",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
      proposedFilters: { municipio: "Pouso Alegre" },
    },
  ].flatMap(({ previousMessage, informationType, proposedFilters }) => [
    createMultiTurnCase({
      name: `${informationType} com município -> agora de alimentação`,
      message: "Agora de alimentação",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "alimentação" },
        allowAdditionalFilters: true,
      },
    }),
    createMultiTurnCase({
      name: `${informationType} com município -> agora de hospedagem`,
      message: "Agora de hospedagem",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "hospedagem" },
        allowAdditionalFilters: true,
      },
    }),
    createMultiTurnCase({
      name: `${informationType} com município -> agora de transportes`,
      message: "Agora de transportes",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters,
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "transportes" },
        allowAdditionalFilters: true,
      },
    }),
  ]),
  ...[
    {
      previousMessage: "Mostre funcionários por município",
      informationType: "funcionarios_por_municipio",
    },
    {
      previousMessage: "Mostre estabelecimentos por município",
      informationType: "estabelecimentos_por_municipio",
    },
    {
      previousMessage: "Mostre funcionários ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
    },
    {
      previousMessage: "Mostre saldo de funcionários ao longo do tempo",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
    },
  ].flatMap(({ previousMessage, informationType }) => [
    createMultiTurnCase({
      name: `${informationType} sem filtros -> agora de alimentação`,
      message: "Agora de alimentação",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "alimentação" },
      },
    }),
    createMultiTurnCase({
      name: `${informationType} sem filtros -> agora de hospedagem`,
      message: "Agora de hospedagem",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "hospedagem" },
      },
    }),
    createMultiTurnCase({
      name: `${informationType} sem filtros -> agora de transportes`,
      message: "Agora de transportes",
      previousMessage,
      previousIntent: {
        intent: "show",
        informationType,
        proposedFilters: {},
      },
      expected: {
        expectedInformationType: informationType,
        expectedFilters: { classificacao: "transportes" },
      },
    }),
  ]),
  createMultiTurnCase({
    name: "estabelecimentos hospedagem em Poços -> agora em Pouso Alegre",
    message: "Agora em Pouso Alegre",
    previousMessage: "Mostre estabelecimentos de hospedagem em Poços de Caldas",
    previousIntent: {
      intent: "show",
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
    expected: {
      expectedInformationType: "estabelecimentos_por_municipio",
      expectedFilters: { municipio: "Pouso Alegre" },
      allowAdditionalFilters: true,
    },
  }),
  createMultiTurnCase({
    name: "funcionários alimentação em Divinópolis -> agora de hospedagem",
    message: "Agora de hospedagem",
    previousMessage: "Mostre funcionários de alimentação em Divinópolis",
    previousIntent: {
      intent: "show",
      informationType: "funcionarios_por_municipio",
      proposedFilters: {
        classificacao: "alimentação",
        municipio: "Divinópolis",
      },
    },
    expected: {
      expectedInformationType: "funcionarios_por_municipio",
      expectedFilters: { classificacao: "hospedagem" },
      allowAdditionalFilters: true,
    },
  }),
  createMultiTurnCase({
    name: "funcionários ao longo do tempo em Poços com hospedagem -> agora em Divinópolis",
    message: "Agora em Divinópolis",
    previousMessage: "Mostre funcionários de hospedagem em Poços de Caldas ao longo do tempo",
    previousIntent: {
      intent: "show",
      informationType: "funcionarios_ao_longo_do_tempo",
      proposedFilters: {
        classificacao: "hospedagem",
        municipio: "Poços de Caldas",
      },
    },
    expected: {
      expectedInformationType: "funcionarios_ao_longo_do_tempo",
      expectedFilters: { municipio: "Divinópolis" },
      allowAdditionalFilters: true,
    },
  }),
  createMultiTurnCase({
    name: "saldo em Pouso com transportes -> agora de alimentação",
    message: "Agora de alimentação",
    previousMessage: "Mostre saldo de funcionários de transportes em Pouso Alegre ao longo do tempo",
    previousIntent: {
      intent: "show",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
      proposedFilters: {
        classificacao: "transportes",
        municipio: "Pouso Alegre",
      },
    },
    expected: {
      expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedFilters: { classificacao: "alimentação" },
      allowAdditionalFilters: true,
    },
  }),
];

const contextualCasesExpanded = [...contextualCases, ...contextualCasesGenerated];
const initialOrientationCasesExpanded = [...initialOrientationCases, ...initialOrientationCasesGenerated];
const curiosityCasesExpanded = [...curiosityCases, ...curiosityCasesGenerated];
const outOfScopeCasesExpanded = [...outOfScopeCases, ...outOfScopeCasesGenerated];
const repeatedCommandCasesExpanded = [...repeatedCommandCases, ...repeatedCommandCasesGenerated];

function assertMinimumDatasetCases(datasetName: string, cases: DatasetCase[]): void {
  if (cases.length < minimumDatasetCaseCount) {
    throw new Error(
      `Dataset ${datasetName} precisa ter no mínimo ${minimumDatasetCaseCount} casos, mas possui ${cases.length}.`,
    );
  }
}

assertMinimumDatasetCases("contextuais", contextualCasesExpanded);
assertMinimumDatasetCases("orientacao_inicial", initialOrientationCasesExpanded);
assertMinimumDatasetCases("curiosidades", curiosityCasesExpanded);
assertMinimumDatasetCases("fora_de_escopo", outOfScopeCasesExpanded);
assertMinimumDatasetCases("multiturno", multiturnCases);
assertMinimumDatasetCases("repeticao", repeatedCommandCasesExpanded);

const selectedFullCommandCases = selectCasesByPercentage("comandos_completos", fullCommandCases);
const selectedContextualCases = selectCasesByPercentage("contextuais", contextualCasesExpanded);
const selectedInitialOrientationCases = selectCasesByPercentage("orientacao_inicial", initialOrientationCasesExpanded);
const selectedCuriosityCases = selectCasesByPercentage("curiosidades", curiosityCasesExpanded);
const selectedOutOfScopeCases = selectCasesByPercentage("fora_de_escopo", outOfScopeCasesExpanded);
const selectedMultiturnCases = selectCasesByPercentage("multiturno", multiturnCases);
const selectedRepeatedCommandCases = selectCasesByPercentage("repeticao", repeatedCommandCasesExpanded);

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

  const itFullCommand = selectedFullCommandCases.length > 0 ? it : it.skip;
  const itContextual = selectedContextualCases.length > 0 ? it : it.skip;
  const itInitialOrientation = selectedInitialOrientationCases.length > 0 ? it : it.skip;
  const itCuriosity = selectedCuriosityCases.length > 0 ? it : it.skip;
  const itOutOfScope = selectedOutOfScopeCases.length > 0 ? it : it.skip;
  const itMultiturn = selectedMultiturnCases.length > 0 ? it : it.skip;
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
    expect(results.every((result) => result.elapsedMs >= 0)).toBe(true);
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
    const results: MeasuredCaseResult[] = [];

    for (const testCase of selectedMultiturnCases) {
      const result = await runMeasuredCase({
        dataset: "multiturno",
        name: testCase.name,
        message: testCase.message,
        deps: buildDeps(),
        history: testCase.history,
        expected: testCase.expected,
      });
      results.push(result);
      collectedResults.push(result);
    }

    expect(results).toHaveLength(selectedMultiturnCases.length);
    expect(results.every((result) => result.elapsedMs >= 0)).toBe(true);
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