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