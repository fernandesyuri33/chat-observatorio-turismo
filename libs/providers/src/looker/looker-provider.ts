import type {
  DashboardAction,
  InformationType,
  IntentV1,
} from "@conversational/domain";
import type { PolicyConfig } from "@conversational/policy";
import type { ActionProvider, ResolveContext } from "../action-provider.js";

/**
 * LookerProvider builds open_url actions using the Looker
 * base URL and paramMap from the policy config.
 */
export class LookerProvider implements ActionProvider {
  readonly id = "looker";

  constructor(private readonly lookerConfig: PolicyConfig["looker"]) {}

  async generate(
    intent: IntentV1,
    _ctx: ResolveContext
  ): Promise<DashboardAction> {
    const url = this.resolveUrlForInformationType(
      intent.intent === "show" ? intent.informationType : undefined
    );
    const intentLabel: Record<string, string> = {
      show: "visualização",
      help: "ajuda",
    };
    const informationTypeLabel: Record<string, string> = {
      estabelecimentos_por_municipio: "Estabelecimentos por município",
      funcionarios_por_municipio: "Funcionários por município",
      funcionarios_ao_longo_do_tempo: "Funcionários ao longo do tempo",
      saldo_funcionarios_ao_longo_do_tempo: "Saldo de funcionários ao longo do tempo",
    };

    const mappedParams: Record<string, unknown> = {};

    // Map proposedFilters through paramMap and serialize as a JSON object in "params"
    for (const [filterKey, filterValue] of Object.entries(intent.proposedFilters)) {
      const paramName = this.lookerConfig.paramMap[filterKey] ?? filterKey;
      if (filterValue !== undefined && filterValue !== null) {
        mappedParams[paramName] = filterValue;
      }
    }

    if (Object.keys(mappedParams).length > 0) {
      url.searchParams.set("params", JSON.stringify(mappedParams));
    }

    const title = intent.intent === "show"
      ? `Looker: ${informationTypeLabel[intent.informationType] ?? intent.informationType}`
      : `Looker: ${intentLabel[intent.intent] ?? intent.intent}`;

    return {
      type: "open_url",
      url: url.toString(),
      title,
      meta: {
        provider: "looker",
        intent: intent.intent,
        informationType: intent.informationType,
      },
    };
  }

  private resolveUrlForInformationType(informationType?: InformationType): URL {
    const url = new URL(this.lookerConfig.baseUrl);

    if (!informationType) {
      return url;
    }

    const mappedPage = this.lookerConfig.informationTypeMap[informationType];
    if (!mappedPage) {
      return url;
    }

    if (mappedPage.startsWith("http://") || mappedPage.startsWith("https://")) {
      return new URL(mappedPage);
    }

    if (mappedPage.startsWith("/")) {
      url.pathname = mappedPage;
      return url;
    }

    const basePathWithoutPage = url.pathname.replace(/\/page(?:\/[^/]+)?\/?$/, "");
    url.pathname = `${basePathWithoutPage}/page/${mappedPage}`;
    return url;
  }
}
