import { describe, expect, it } from "vitest";
import { buildLookerStudioUrl } from "../src/index";

const baseUrl = "https://lookerstudio.google.com/embed/reporting/abc123/page/p_1";

describe("buildLookerStudioUrl", () => {
  it("adds filters in deterministic order", () => {
    const url = buildLookerStudioUrl(baseUrl, {
      indicador: "visitas",
      mes: [12, 1],
      ano: [2024, 2023],
      cidade: "Sao Paulo"
    });

    expect(url).toBe(
      "https://lookerstudio.google.com/embed/reporting/abc123/page/p_1?filters=cidade:Sao%20Paulo;ano:2023,2024;mes:1,12;indicador:visitas"
    );
  });

  it("preserves existing query params", () => {
    const url = buildLookerStudioUrl(`${baseUrl}?foo=bar`, {
      cidade: "Curitiba"
    });

    expect(url).toBe(
      "https://lookerstudio.google.com/embed/reporting/abc123/page/p_1?foo=bar&filters=cidade:Curitiba"
    );
  });

  it("removes filters when empty", () => {
    const url = buildLookerStudioUrl(`${baseUrl}?filters=cidade:Sao%20Paulo`, {});
    expect(url).toBe(baseUrl);
  });
});
