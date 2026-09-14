import { NotImplementedError } from "@/server/integrations/types";

import type { AgentContext, AgentResponse, AiProvider } from "./types";

/**
 * Placeholder AI provider.
 *
 * NOT CONNECTED YET. No API key, no model call. `generate` throws
 * NotImplementedError. A real provider (OpenAI, Anthropic, ...) will be added
 * later and must:
 *   1. Build a system prompt from the agent settings + strict grounding rules.
 *   2. Include ONLY the supplied context (product, knowledge, history,
 *      verified integration facts). Never invent prices, dates, stock, etc.
 *   3. Return a structured AgentResponse (reply + nextStage + actions).
 */
export class PlaceholderAiProvider implements AiProvider {
  readonly name = "unconfigured-ai-provider";

  isConfigured(): boolean {
    return false;
  }

  async generate(_context: AgentContext): Promise<AgentResponse> {
    throw new NotImplementedError(this.name, "generate");
  }
}

/** Returns the currently configured AI provider (placeholder for now). */
export function getAiProvider(): AiProvider {
  return new PlaceholderAiProvider();
}
