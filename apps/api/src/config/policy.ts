import { PolicyConfigSchema, type PolicyConfig } from "@conversational/policy";
import { synonyms } from "./sinonimos.js";

export const policyConfig: PolicyConfig = PolicyConfigSchema.parse({
  minConfidence: 0.5,
  synonyms,
  activeProvider: "looker",
  fallback: {
    retryCount: 3,
    contextualOrientationOptionCount: 3,
  },
  history: {
    maxMessages: 4,
    ttlSeconds: 1800,
  },
  curiosityFaq: [
    {
      questionExamples: [
        "O setor turístico de Poços de Caldas está evoluindo?",
        "O turismo de Poços de Caldas está crescendo?",
      ],
      response:
        "Uma forma de explorar essa questão é visualizar a evolução da quantidade de funcionários ao longo do tempo. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
    },
    {
      questionExamples: [
        "Qual município tem mais empregos no turismo?",
        "Onde o turismo emprega mais pessoas?",
      ],
      response:
        "Uma forma de explorar essa questão é comparar a quantidade de funcionários por município. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar a quantidade de funcionários por município",
      informationType: "funcionarios_por_municipio",
    },
    {
      questionExamples: [
        "Quais cidades têm mais estabelecimentos turísticos?",
        "Onde há mais estabelecimentos do setor turístico?",
      ],
      response:
        "Uma forma de explorar essa questão é comparar a quantidade de estabelecimentos por município. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar a quantidade de estabelecimentos por município",
      informationType: "estabelecimentos_por_municipio",
    },
    {
      questionExamples: [
        "O emprego no turismo está aumentando ou diminuindo?",
        "O saldo de empregos do turismo está positivo?",
      ],
      response:
        "Uma forma de explorar essa questão é visualizar o saldo de funcionários ao longo do tempo. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar o saldo de funcionários ao longo do tempo",
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
    },
  ],
  looker: {
    baseUrl:
      "https://datastudio.google.com/embed/reporting/70b05460-31ac-47ad-87e0-d7201ca27609/page/",
    paramMap: {},
    paramMapByInformationType: {
      estabelecimentos_por_municipio: {
        municipio: "ds19.p_municipio",
        classificacao: "ds19.p_classificacao",
      },
      funcionarios_por_municipio: {
        municipio: "ds17.p_municipio",
        classificacao: "ds17.p_classificacao",
      },
      funcionarios_ao_longo_do_tempo: {
        municipio: "ds18.p_municipio",
        classificacao: "ds18.p_classificacao",
      },
      saldo_funcionarios_ao_longo_do_tempo: {
        municipio: "ds20.p_municipio",
        classificacao: "ds20.p_classificacao",
      },
    },
    informationTypeMap: {
      estabelecimentos_por_municipio: "p_3niel4jewd",
      funcionarios_por_municipio: "p_joj1sbkewd",
      funcionarios_ao_longo_do_tempo: "p_nv1avgkewd",
      saldo_funcionarios_ao_longo_do_tempo: "p_fnowokk6wd",
    },
  },
});
