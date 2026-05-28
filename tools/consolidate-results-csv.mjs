import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const ARTIFACTS_DIR = join(ROOT_DIR, "artifacts");
const CASES_OUTPUT_PATH = join(ARTIFACTS_DIR, "test-cases-summary.csv");
const RESULTS_OUTPUT_PATH = join(ARTIFACTS_DIR, "test-results-summary.csv");
const MODEL_TABLES_DIR = join(ARTIFACTS_DIR, "test-results-by-model");

const TEST_TYPE_BY_FOLDER = {
  "1-41-testes-base": "base",
  "2-141-testes-expandidos": "expandido",
};

function toCsvValue(value) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function toCsv(headers, rows) {
  const headerLine = headers.map(toCsvValue).join(",");
  const lines = rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(","));
  return [headerLine, ...lines].join("\n") + "\n";
}

function findResultFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findResultFiles(fullPath));
      continue;
    }

    const isResultFile =
      entry.name.startsWith("real-llm-results-") && entry.name.endsWith(".json");

    if (isResultFile) {
      files.push(fullPath);
    }
  }

  return files;
}

function detectTestType(filePath) {
  const relativePath = relative(ARTIFACTS_DIR, filePath);

  for (const [folderName, testType] of Object.entries(TEST_TYPE_BY_FOLDER)) {
    if (relativePath.startsWith(`${folderName}/`)) {
      return testType;
    }
  }

  return null;
}

function parseResultFile(filePath) {
  const rawContent = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(rawContent);

  const model = parsed?.model;
  const summary = parsed?.summary;
  const results = parsed?.results;

  if (typeof model !== "string" || model.trim() === "") {
    throw new Error("Campo 'model' ausente ou inválido.");
  }

  if (
    !summary ||
    typeof summary.totalCases !== "number" ||
    typeof summary.passedCases !== "number" ||
    typeof summary.failedCases !== "number" ||
    typeof summary.averageElapsedMs !== "number" ||
    typeof summary.minElapsedMs !== "number" ||
    typeof summary.maxElapsedMs !== "number"
  ) {
    throw new Error("Campo 'summary' ausente ou inválido.");
  }

  if (!Array.isArray(results)) {
    throw new Error("Campo 'results' ausente ou inválido.");
  }

  return {
    model,
    summary,
    results,
  };
}

function caseUniqueKey(result) {
  const dataset = typeof result?.dataset === "string" ? result.dataset : "";
  const name = typeof result?.name === "string" ? result.name : "";
  const message = typeof result?.message === "string" ? result.message : "";
  return `${dataset}|||${name}|||${message}`;
}

function formatPercent(passed, total) {
  if (!total) return "0.00";
  return ((passed / total) * 100).toFixed(2);
}

function formatSecondsFromMs(valueInMs) {
  return (valueInMs / 1000).toFixed(2);
}

function toSafeFileSegment(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function consolidate() {
  const allFiles = findResultFiles(ARTIFACTS_DIR);
  const validEntries = [];

  for (const filePath of allFiles) {
    const testType = detectTestType(filePath);

    if (!testType) {
      continue;
    }

    try {
      const parsed = parseResultFile(filePath);
      validEntries.push({ filePath, testType, ...parsed });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Erro desconhecido";
      console.warn(`[aviso] Ignorando arquivo inválido: ${filePath} -> ${reason}`);
    }
  }

  if (validEntries.length === 0) {
    throw new Error("Nenhum arquivo de resultado válido foi encontrado em artifacts.");
  }

  const caseMapsByType = {
    base: new Map(),
    expandido: new Map(),
  };

  for (const entry of validEntries) {
    const currentMap = caseMapsByType[entry.testType];

    for (const result of entry.results) {
      const dataset = typeof result?.dataset === "string" ? result.dataset.trim() : "";
      const name = typeof result?.name === "string" ? result.name.trim() : "";
      const message = typeof result?.message === "string" ? result.message.trim() : "";

      if (!dataset || !name || !message) {
        continue;
      }

      const uniqueKey = caseUniqueKey({ dataset, name, message });
      currentMap.set(uniqueKey, dataset);
    }
  }

  const allDatasets = new Set();
  for (const map of Object.values(caseMapsByType)) {
    for (const dataset of map.values()) {
      allDatasets.add(dataset);
    }
  }

  const orderedDatasets = [...allDatasets].sort((a, b) => a.localeCompare(b));
  const caseHeaders = ["tipo_teste", "total_testes", ...orderedDatasets];

  const caseRows = ["base", "expandido"].map((testType) => {
    const map = caseMapsByType[testType];
    const datasetCounts = Object.fromEntries(orderedDatasets.map((dataset) => [dataset, 0]));

    for (const dataset of map.values()) {
      datasetCounts[dataset] += 1;
    }

    return {
      tipo_teste: testType,
      total_testes: map.size,
      ...datasetCounts,
    };
  });

  const resultRows = validEntries
    .map((entry) => {
      const totalCases = entry.summary.totalCases;
      const passedCases = entry.summary.passedCases;
      const failedCases = entry.summary.failedCases;
      const totalsAreConsistent = passedCases + failedCases === totalCases;

      if (!totalsAreConsistent) {
        console.warn(
          `[aviso] Totais inconsistentes em ${entry.filePath}: ` +
            `passed (${passedCases}) + failed (${failedCases}) != total (${totalCases}).`
        );
      }

      const hasAverage = Number.isFinite(entry.summary.averageElapsedMs);
      const totalElapsedMs = hasAverage
        ? entry.summary.averageElapsedMs * totalCases
        : entry.results.reduce((sum, result) => sum + (result.elapsedMs ?? 0), 0);

      return {
        modelo_avaliado: entry.model,
        tipo_teste: entry.testType,
        total_casos: totalCases,
        casos_corretos: passedCases,
        casos_incorretos: failedCases,
        taxa_acerto: formatPercent(passedCases, totalCases),
        tempo_medio_por_caso_s: formatSecondsFromMs(entry.summary.averageElapsedMs),
        tempo_minimo_s: formatSecondsFromMs(entry.summary.minElapsedMs),
        tempo_maximo_s: formatSecondsFromMs(entry.summary.maxElapsedMs),
        tempo_total_s: formatSecondsFromMs(totalElapsedMs),
      };
    })
    .sort((a, b) => {
      const byModel = a.modelo_avaliado.localeCompare(b.modelo_avaliado);
      if (byModel !== 0) return byModel;
      return a.tipo_teste.localeCompare(b.tipo_teste);
    });

  const resultHeaders = [
    "modelo_avaliado",
    "tipo_teste",
    "total_casos",
    "casos_corretos",
    "casos_incorretos",
    "taxa_acerto",
    "tempo_medio_por_caso_s",
    "tempo_minimo_s",
    "tempo_maximo_s",
    "tempo_total_s",
  ];

  const groupedByModel = new Map();

  for (const entry of validEntries) {
    if (!groupedByModel.has(entry.model)) {
      groupedByModel.set(entry.model, new Map());
    }

    const groups = groupedByModel.get(entry.model);

    for (const result of entry.results) {
      const dataset = typeof result?.dataset === "string" ? result.dataset.trim() : "";
      if (!dataset) {
        continue;
      }

      if (!groups.has(dataset)) {
        groups.set(dataset, {
          total_casos: 0,
          acertos: 0,
          falhas: 0,
        });
      }

      const bucket = groups.get(dataset);
      bucket.total_casos += 1;

      if (result?.passed === true) {
        bucket.acertos += 1;
      } else {
        bucket.falhas += 1;
      }
    }
  }

  mkdirSync(MODEL_TABLES_DIR, { recursive: true });

  const usedModelFileNames = new Set();
  let modelTablesGenerated = 0;

  for (const [model, groups] of groupedByModel) {
    const rows = [...groups.entries()]
      .map(([grupo_teste, stats]) => ({
        grupo_teste,
        total_casos: stats.total_casos,
        acertos: stats.acertos,
        falhas: stats.falhas,
        taxa_acerto: formatPercent(stats.acertos, stats.total_casos),
      }))
      .sort((a, b) => a.grupo_teste.localeCompare(b.grupo_teste));

    const headers = ["grupo_teste", "total_casos", "acertos", "falhas", "taxa_acerto"];

    const baseName = toSafeFileSegment(model) || "modelo";
    let fileName = `${baseName}.csv`;
    let suffix = 1;

    while (usedModelFileNames.has(fileName)) {
      suffix += 1;
      fileName = `${baseName}-${suffix}.csv`;
    }

    usedModelFileNames.add(fileName);

    const outputPath = join(MODEL_TABLES_DIR, fileName);
    writeFileSync(outputPath, toCsv(headers, rows), "utf8");
    modelTablesGenerated += 1;
    console.log(`Arquivo gerado: ${outputPath}`);
  }

  writeFileSync(CASES_OUTPUT_PATH, toCsv(caseHeaders, caseRows), "utf8");
  writeFileSync(RESULTS_OUTPUT_PATH, toCsv(resultHeaders, resultRows), "utf8");

  console.log(`Arquivo gerado: ${CASES_OUTPUT_PATH}`);
  console.log(`Arquivo gerado: ${RESULTS_OUTPUT_PATH}`);
  console.log(`Tabelas por modelo geradas: ${modelTablesGenerated}`);
  console.log(`Arquivos válidos consolidados: ${validEntries.length}`);
}

try {
  consolidate();
} catch (error) {
  const reason = error instanceof Error ? error.message : "Erro desconhecido";
  console.error(`[erro] Falha na consolidação: ${reason}`);
  process.exitCode = 1;
}
