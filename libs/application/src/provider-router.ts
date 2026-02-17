import type { ActionProvider, ResolveContext } from "@conversational/providers";
import type { PolicyConfig } from "@conversational/policy";

/**
 * ProviderRouter selects the appropriate ActionProvider
 * based on routing rules from the policy config and
 * whether the provider supports the given context.
 */
export class ProviderRouter {
  private readonly providers: Map<string, ActionProvider>;

  constructor(
    providers: ActionProvider[],
    private readonly routingRules: PolicyConfig["routing"]
  ) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
  }

  /**
   * Resolve which provider should handle a given intent + context.
   * Returns undefined if no suitable provider is found.
   */
  resolve(intentType: string, ctx: ResolveContext): ActionProvider | undefined {
    // 1. Check explicit routing rule
    const explicitId = this.routingRules[intentType];
    if (explicitId) {
      const provider = this.providers.get(explicitId);
      if (provider && provider.supports(ctx)) {
        return provider;
      }
    }

    // 2. Fallback: first provider that supports the context
    for (const provider of this.providers.values()) {
      if (provider.supports(ctx)) {
        return provider;
      }
    }

    return undefined;
  }
}
