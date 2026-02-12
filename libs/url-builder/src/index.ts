import type { Filters } from "@conversational/contracts";

const FILTER_ORDER: Array<keyof Filters> = ["cidade", "ano", "mes", "indicador"];

function normalizeNumberArray(values: number[] | undefined): number[] | undefined {
  if (!values || values.length === 0) return undefined;
  const unique = Array.from(new Set(values));
  unique.sort((a, b) => a - b);
  return unique;
}

function serializeFilters(filters: Filters): string | null {
  const normalized: Filters = {
    ...filters,
    ano: normalizeNumberArray(filters.ano),
    mes: normalizeNumberArray(filters.mes)
  };

  const parts: string[] = [];
  for (const key of FILTER_ORDER) {
    const value = normalized[key];
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      parts.push(`${key}:${value.join(",")}`);
      continue;
    }

    parts.push(`${key}:${value}`);
  }

  return parts.length > 0 ? parts.join(";") : null;
}

export function buildLookerStudioUrl(baseUrl: string, filters: Filters): string {
  const url = new URL(baseUrl);
  const serialized = serializeFilters(filters);

  if (serialized) {
    url.searchParams.set("filters", serialized);
  } else {
    url.searchParams.delete("filters");
  }

  return url.toString();
}

export const __private__ = { serializeFilters };
