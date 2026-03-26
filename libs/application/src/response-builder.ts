import {
  INFORMATION_TYPE_VALUES,
  DashboardActionSchema,
  type DashboardAction,
  type IntentV1,
  type InformationType,
} from "@conversational/domain";
import type { ActionProvider, ResolveContext } from "@conversational/providers";
import { explainOnlyFallback } from "./fallback.js";

// ── Labels para orientação contextual ───────────────────────────

const INFORMATION_TYPE_LABEL: Record<InformationType, string> = {
  estabelecimentos_por_municipio: "Quantidade de estabelecimentos por município",
  funcionarios_por_municipio: "Quantidade de funcionários por município",
  funcionarios_ao_longo_do_tempo: "Quantidade de funcionários ao longo do tempo",
  saldo_funcionarios_ao_longo_do_tempo: "Saldo de funcionários ao longo do tempo",
};

// ── Builders de mensagem ────────────────────────────────────────

export interface ContextualOrientationFilters {
  classificacao?: string | null;
  municipio?: string;
}

export function buildContextualOrientationMessage(
  filters: ContextualOrientationFilters
): string {
  const base = "A partir desse recorte, você pode explorar:";

  if (filters.municipio) {
    return `${base} em ${filters.municipio}. Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
  }

  if (filters.classificacao) {
    return `${base} para a classificação ${filters.classificacao}. Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
  }

  return `${base} Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
}

export function buildContextualOrientationSuggestions(
  optionCount: number
): string[] {
  return INFORMATION_TYPE_VALUES
    .slice(0, optionCount)
    .map((informationType) => INFORMATION_TYPE_LABEL[informationType]);
}

/**
 * Constrói uma ação ask_missing_information com sugestões dos tipos de análise disponíveis.
 */
export function buildAskMissingInformationAction(
  missing: string[],
  filters: ContextualOrientationFilters,
  optionCount: number
): DashboardAction {
  const filterContext = filters.municipio
    ? ` para ${filters.municipio}`
    : filters.classificacao
      ? ` para ${filters.classificacao}`
      : "";

  const context: Record<string, string> = {};
  if (filters.classificacao) context["classificacao"] = filters.classificacao;
  if (filters.municipio) context["municipio"] = filters.municipio;

  return {
    type: "ask_missing_information",
    message: `Entendi o contexto${filterContext}, mas preciso saber qual análise você quer ver. Escolha uma das opções:`,
    suggestions: buildContextualOrientationSuggestions(optionCount),
    missing,
    context: Object.keys(context).length > 0 ? context : undefined,
  };
}

// ── Builders de ação ────────────────────────────────────────────

export interface CuriosityFaqData {
  response: string;
  suggestion: string;
  informationType: string;
}

export function buildCuriosityToAction(entry: CuriosityFaqData): DashboardAction {
  return {
    type: "explain_only",
    message: entry.response,
    suggestions: [entry.suggestion],
    meta: {
      curiosityToAction: true,
      informationType: entry.informationType,
    },
  };
}

export function buildDefaultInitialOrientationAction(): DashboardAction {
  return explainOnlyFallback(
    "Posso sugerir alguns caminhos de exploração:",
    [
      "Comparar estabelecimentos entre municípios",
      "Visualizar a quantidade de funcionários por município",
      "Acompanhar a evolução de funcionários ao longo do tempo",
    ]
  );
}

export async function resolveInitialOrientationAction(
  provider: ActionProvider,
  ctx: ResolveContext
): Promise<DashboardAction> {
  const initialOrientationIntent: IntentV1 = {
    intent: "initial_orientation",
    proposedFilters: {},
    confidence: 1,
  };

  try {
    const action = await provider.generate(initialOrientationIntent, ctx);
    const validated = DashboardActionSchema.safeParse(action);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // Continua para a ação padrão de orientação
  }

  return buildDefaultInitialOrientationAction();
}
