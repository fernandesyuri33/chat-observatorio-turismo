import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractSchemaHints, fillPromptTemplate } from "./schema-hints.js";

const tokens = {
  informationTypeBulletsToken: "__IT_BULLETS__",
  informationTypeOptionsToken: "__IT_OPTIONS__",
  classificacaoBulletsToken: "__CL_BULLETS__",
  classificacaoOptionsToken: "__CL_OPTIONS__",
};

const template = [
  "Tipos:",
  tokens.informationTypeBulletsToken,
  "IT Options:",
  tokens.informationTypeOptionsToken,
  "Classificações:",
  tokens.classificacaoBulletsToken,
  "CL Options:",
  tokens.classificacaoOptionsToken,
].join("\n");

const intentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("show"),
    informationType: z.enum(["it_a", "it_b"]),
    proposedFilters: z.object({
      classificacao: z.enum(["class_1", "class_2"]).optional(),
      municipio: z.string().optional(),
    }),
    confidence: z.number(),
  }),
  z.object({
    intent: z.literal("help"),
    proposedFilters: z.object({
      classificacao: z.enum(["class_1", "class_2"]).optional(),
      municipio: z.string().optional(),
    }),
    confidence: z.number(),
  }),
]);

describe("schema-hints", () => {
  it("extrai informationType e classificacao de schema de união discriminada", () => {
    const hints = extractSchemaHints(intentSchema);

    expect(hints.informationTypes).toEqual(["it_a", "it_b"]);
    expect(hints.classificacoes).toEqual(["class_1", "class_2"]);
  });

  it("preenche template de prompt com valores extraídos do schema", () => {
    const prompt = fillPromptTemplate(template, intentSchema, tokens);

    expect(prompt).toContain('- "it_a"');
    expect(prompt).toContain('- "it_b"');
    expect(prompt).toContain("it_a|it_b");
    expect(prompt).toContain('- "class_1"');
    expect(prompt).toContain('- "class_2"');
    expect(prompt).toContain("class_1|class_2");
  });

  it("usa placeholders genéricos para schemas não discriminados", () => {
    const fallbackSchema = z.object({ any: z.string() });
    const prompt = fillPromptTemplate(template, fallbackSchema, tokens);

    expect(prompt).toContain("valor_permitido_pelo_schema");
  });
});
