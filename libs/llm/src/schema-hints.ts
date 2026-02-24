import { z } from "zod";

export interface SchemaHints {
  informationTypes: string[];
  classificacoes: string[];
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema.removeDefault());
  }

  return schema;
}

function extractEnumValues(schema: z.ZodTypeAny): string[] {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodEnum) {
    return [...unwrapped.options];
  }

  if (unwrapped instanceof z.ZodNativeEnum) {
    return Object.values(unwrapped.enum).filter((value): value is string => typeof value === "string");
  }

  return [];
}

export function extractSchemaHints(schema: z.ZodTypeAny): SchemaHints {
  const unwrapped = unwrapSchema(schema);
  if (!(unwrapped instanceof z.ZodDiscriminatedUnion)) {
    return { informationTypes: [], classificacoes: [] };
  }

  let informationTypes: string[] = [];
  let classificacoes: string[] = [];

  for (const option of unwrapped.options) {
    if (!(option instanceof z.ZodObject)) {
      continue;
    }

    if (informationTypes.length === 0 && "informationType" in option.shape) {
      informationTypes = extractEnumValues(option.shape["informationType"] as z.ZodTypeAny);
    }

    if (classificacoes.length === 0 && "proposedFilters" in option.shape) {
      const proposedFilters = unwrapSchema(option.shape["proposedFilters"] as z.ZodTypeAny);
      if (proposedFilters instanceof z.ZodObject && "classificacao" in proposedFilters.shape) {
        classificacoes = extractEnumValues(proposedFilters.shape["classificacao"] as z.ZodTypeAny);
      }
    }

    if (informationTypes.length > 0 && classificacoes.length > 0) {
      break;
    }
  }

  return { informationTypes, classificacoes };
}

export function fillPromptTemplate(
  template: string,
  schema: z.ZodTypeAny,
  tokens: {
    informationTypeBulletsToken: string;
    informationTypeOptionsToken: string;
    classificacaoBulletsToken: string;
    classificacaoOptionsToken: string;
  }
): string {
  const { informationTypes, classificacoes } = extractSchemaHints(schema);

  const informationTypeList = informationTypes.length > 0 ? informationTypes : ["valor_permitido_pelo_schema"];
  const classificacaoList = classificacoes.length > 0 ? classificacoes : ["valor_permitido_pelo_schema"];

  const informationTypeBullets = informationTypeList
    .map((informationType) => `- "${informationType}"`)
    .join("\n");

  const classificacaoBullets = classificacaoList
    .map((classificacao) => `- "${classificacao}"`)
    .join("\n");

  return template
    .replace(tokens.informationTypeBulletsToken, informationTypeBullets)
    .replace(tokens.informationTypeOptionsToken, informationTypeList.join("|"))
    .replace(tokens.classificacaoBulletsToken, classificacaoBullets)
    .replace(tokens.classificacaoOptionsToken, classificacaoList.join("|"));
}
