import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveDashboardAction } from "../../src/resolve-dashboard-action.usecase";
import type {
  ResolveDashboardActionDeps,
  StageRationale,
} from "../../src/resolve-dashboard-action.usecase";
import type { DashboardAction } from "@conversational/domain";
import type { ConversationTurn } from "@conversational/llm";
import type { NormalizedIntent } from "@conversational/policy";

export interface MeasuredCaseExpectation {
  allowedActionTypes?: DashboardAction["type"][];
  forbiddenActionTypes?: DashboardAction["type"][];
  expectedStage1Classification?: string;
  expectedInformationType?: string;
  expectedFilters?: Record<string, unknown>;
  allowAdditionalFilters?: boolean;
  expectNoFilters?: boolean;
  expectedSuggestion?: string;
}

export interface RunMeasuredCaseInput {
  dataset: string;
  name: string;
  message: string;
  deps: ResolveDashboardActionDeps;
  expected?: MeasuredCaseExpectation;
  history?: ConversationTurn[];
}

export interface MeasuredCaseResult {
  dataset: string;
  name: string;
  message: string;
  actionType: DashboardAction["type"];
  elapsedMs: number;
  stage1Classification?: string;
  stage1Confidence?: number;
  stage2InformationType?: string;
  stage2Confidence?: number;
  filters?: Record<string, unknown>;
  passed: boolean;
  notes: string[];
  action: DashboardAction;
  actionSummary: Record<string, unknown>;
  resolvedIntent?: {
    intent: NormalizedIntent["intent"];
    informationType?: string;
    proposedFilters: Record<string, unknown>;
    confidence: number;
    rationale?: string;
  };
}

export interface MeasuredResultsSummary {
  model: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  fallbackCases: number;
  averageElapsedMs: number;
  minElapsedMs: number;
  maxElapsedMs: number;
  actionTypeCounts: Record<string, number>;
}

function parseOpenUrl(urlString: string): {
  pathname: string;
  params: Record<string, unknown> | null;
} {
  const url = new URL(urlString);
  const rawParams = url.searchParams.get("params");

  return {
    pathname: url.pathname,
    params: rawParams ? JSON.parse(rawParams) as Record<string, unknown> : null,
  };
}

function summarizeAction(action: DashboardAction): Record<string, unknown> {
  switch (action.type) {
    case "open_url": {
      const { pathname, params } = parseOpenUrl(action.url);
      return {
        pathname,
        params,
        url: action.url,
        title: action.title,
        message: action.message,
        meta: action.meta,
      };
    }
    case "run_query":
      return {
        function: action.function,
        args: action.args,
        message: action.message,
        meta: action.meta,
      };
    case "apply_filters":
      return {
        filters: action.filters,
        target: action.target,
        message: action.message,
        meta: action.meta,
      };
    case "explain_only":
      return {
        suggestions: action.suggestions,
        message: action.message,
        meta: action.meta,
      };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported action type: ${String(exhaustiveCheck)}`);
    }
  }
}

function evaluateMeasuredCase(
  result: Omit<MeasuredCaseResult, "passed" | "notes">,
  expected?: MeasuredCaseExpectation,
): Pick<MeasuredCaseResult, "passed" | "notes"> {
  const notes: string[] = [];

  if (!expected) {
    return { passed: true, notes };
  }

  if (
    expected.expectedStage1Classification &&
    result.stage1Classification !== expected.expectedStage1Classification
  ) {
    notes.push(
      `stage1Classification divergente: ${String(result.stage1Classification)} (esperado: ${expected.expectedStage1Classification})`
    );
  }

  if (
    expected.allowedActionTypes &&
    !expected.allowedActionTypes.includes(result.actionType)
  ) {
    notes.push(
      `actionType fora do esperado: ${result.actionType} (esperado: ${expected.allowedActionTypes.join(", ")})`
    );
  }

  if (
    expected.forbiddenActionTypes &&
    expected.forbiddenActionTypes.includes(result.actionType)
  ) {
    notes.push(`actionType proibido: ${result.actionType}`);
  }

  if (
    expected.expectedInformationType &&
    result.stage2InformationType !== expected.expectedInformationType
  ) {
    notes.push(
      `informationType divergente: ${String(result.stage2InformationType)} (esperado: ${expected.expectedInformationType})`
    );
  }

  const actualFilters = result.filters ?? result.resolvedIntent?.proposedFilters ?? {};
  const actualFilterEntries = Object.entries(actualFilters).filter(([, value]) => value !== undefined);

  if (expected.expectNoFilters && actualFilterEntries.length > 0) {
    const unexpectedFilters = Object.fromEntries(actualFilterEntries);
    notes.push(`filtros inesperados: ${JSON.stringify(unexpectedFilters)}`);
  }

  if (expected.expectedFilters) {
    const expectedFilterEntries = Object.entries(expected.expectedFilters).filter(([, value]) => value !== undefined);
    const expectedFilterKeys = new Set(expectedFilterEntries.map(([key]) => key));

    for (const [filterKey, filterValue] of expectedFilterEntries) {
      if (actualFilters[filterKey] !== filterValue) {
        notes.push(
          `filtro divergente em ${filterKey}: ${String(actualFilters[filterKey])} (esperado: ${String(filterValue)})`
        );
      }
    }

    if (!expected.allowAdditionalFilters) {
      for (const [filterKey, filterValue] of actualFilterEntries) {
        if (!expectedFilterKeys.has(filterKey)) {
          notes.push(
            `filtro inesperado em ${filterKey}: ${String(filterValue)}`
          );
        }
      }
    }
  }

  if (expected.expectedSuggestion) {
    const suggestions = "suggestions" in result.action ? result.action.suggestions : [];
    if (!suggestions.includes(expected.expectedSuggestion)) {
      notes.push(`sugestão esperada ausente: ${expected.expectedSuggestion}`);
    }
  }

  return {
    passed: notes.length === 0,
    notes,
  };
}

export async function runMeasuredCase(
  input: RunMeasuredCaseInput,
): Promise<MeasuredCaseResult> {
  const { dataset, name, message, deps, expected, history } = input;
  let stageRationale: StageRationale = {};
  let resolvedIntent: NormalizedIntent | undefined;
  const startedAt = Date.now();

  const action = await resolveDashboardAction(deps, {
    message,
    history,
    onIntentResolved: (intent) => {
      resolvedIntent = intent;
    },
    onStageRationale: (rationale) => {
      stageRationale = rationale;
    },
  });

  const resultBase: Omit<MeasuredCaseResult, "passed" | "notes"> = {
    dataset,
    name,
    message,
    actionType: action.type,
    elapsedMs: Date.now() - startedAt,
    stage1Classification: stageRationale.stage1?.classification,
    stage1Confidence: stageRationale.stage1?.confidence,
    stage2InformationType:
      stageRationale.stage2?.informationType ?? resolvedIntent?.informationType,
    stage2Confidence: stageRationale.stage2?.confidence,
    filters:
      stageRationale.stage2?.filters ??
      (resolvedIntent ? { ...resolvedIntent.proposedFilters } : undefined),
    action,
    actionSummary: summarizeAction(action),
    resolvedIntent: resolvedIntent
      ? {
          intent: resolvedIntent.intent,
          informationType: resolvedIntent.informationType,
          proposedFilters: { ...resolvedIntent.proposedFilters },
          confidence: resolvedIntent.confidence,
          rationale: resolvedIntent.rationale,
        }
      : undefined,
  };

  return {
    ...resultBase,
    ...evaluateMeasuredCase(resultBase, expected),
  };
}

export function summarizeMeasuredResults(
  results: MeasuredCaseResult[],
): MeasuredResultsSummary {
  const totalElapsedMs = results.reduce((sum, result) => sum + result.elapsedMs, 0);
  const actionTypeCounts = results.reduce<Record<string, number>>((counts, result) => {
    counts[result.actionType] = (counts[result.actionType] ?? 0) + 1;
    return counts;
  }, {});
  const elapsedValues = results.map((result) => result.elapsedMs);

  return {
    model: process.env["OLLAMA_MODEL"] ?? "gemma3:4b",
    totalCases: results.length,
    passedCases: results.filter((result) => result.passed).length,
    failedCases: results.filter((result) => !result.passed).length,
    fallbackCases: results.filter((result) => result.actionType === "explain_only").length,
    averageElapsedMs:
      results.length > 0 ? Number((totalElapsedMs / results.length).toFixed(2)) : 0,
    minElapsedMs: results.length > 0 ? Math.min(...elapsedValues) : 0,
    maxElapsedMs: results.length > 0 ? Math.max(...elapsedValues) : 0,
    actionTypeCounts,
  };
}

export function printMeasuredResultsTable(results: MeasuredCaseResult[]): void {
  console.table(
    results.map((result) => ({
      dataset: result.dataset,
      name: result.name,
      actionType: result.actionType,
      elapsedMs: result.elapsedMs,
      passed: result.passed,
      stage1: result.stage1Classification,
      stage2: result.stage2InformationType,
      notes: result.notes.join(" | "),
    }))
  );
}

export async function writeMeasuredResultsArtifacts(results: MeasuredCaseResult[]): Promise<{
  canonicalPath: string;
  snapshotPath: string;
  summary: MeasuredResultsSummary;
}>;
export async function writeMeasuredResultsArtifacts(
  results: MeasuredCaseResult[],
  outputDir: string | URL,
): Promise<{
  canonicalPath: string;
  snapshotPath: string;
  summary: MeasuredResultsSummary;
}>;
export async function writeMeasuredResultsArtifacts(
  results: MeasuredCaseResult[],
  outputDir?: string | URL,
): Promise<{
  canonicalPath: string;
  snapshotPath: string;
  summary: MeasuredResultsSummary;
}> {
  const generatedAt = new Date().toISOString();
  const summary = summarizeMeasuredResults(results);
  const artifactsDir = outputDir instanceof URL
    ? outputDir
    : typeof outputDir === "string"
      ? pathToFileURL(outputDir.endsWith("/") ? outputDir : `${outputDir}/`)
      : new URL("../../../../artifacts/", import.meta.url);
  const canonicalUrl = new URL("real-llm-results.json", artifactsDir);
  const snapshotUrl = new URL(
    `real-llm-results-${generatedAt.replace(/[:.]/g, "-")}.json`,
    artifactsDir,
  );
  const payload = {
    generatedAt,
    model: summary.model,
    summary,
    results,
  };

  await mkdir(artifactsDir, { recursive: true });
  const serialized = JSON.stringify(payload, null, 2);
  await Promise.all([
    writeFile(canonicalUrl, serialized, "utf8"),
    writeFile(snapshotUrl, serialized, "utf8"),
  ]);

  return {
    canonicalPath: fileURLToPath(canonicalUrl),
    snapshotPath: fileURLToPath(snapshotUrl),
    summary,
  };
}