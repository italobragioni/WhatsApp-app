import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { env } from "@/lib/env";
import { logger } from "@/server/logger/logger";

import { AI_CONFIG, isAiConfigured } from "./config";
import { buildSystemPrompt } from "./guardrails";
import { mapModelOutput, modelOutputSchema } from "./model-output";
import type { AgentContext, AgentResponse, AiProvider } from "./types";
import { AiUnavailableError } from "./types";

/** Map stored conversation turns to chat messages for the model. */
function historyToMessages(
  context: AgentContext,
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];
  for (const turn of context.history) {
    if (!turn.content?.trim()) continue;
    if (turn.sender === "CUSTOMER") {
      messages.push({ role: "user", content: turn.content });
    } else if (turn.sender === "AGENT" || turn.sender === "HUMAN") {
      messages.push({ role: "assistant", content: turn.content });
    }
    // SYSTEM turns are internal notes; they are not replayed to the model.
  }
  // Defensive: ensure the last turn is the incoming customer message.
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    messages.push({ role: "user", content: context.incomingMessage.content });
  }
  return messages;
}

/**
 * OpenAI-backed provider. Uses the official SDK and the centrally-configured
 * model. Requests a JSON object and validates it with zod before mapping to a
 * structured AgentResponse — the model's free text is never trusted directly.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  isConfigured(): boolean {
    return true;
  }

  async generate(context: AgentContext): Promise<AgentResponse> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...historyToMessages(context),
    ];

    let content: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create({
        model: AI_CONFIG.model,
        temperature: AI_CONFIG.temperature,
        max_tokens: AI_CONFIG.maxOutputTokens,
        response_format: { type: "json_object" },
        messages,
      });
      content = completion.choices[0]?.message?.content;

      // Usage logging for future cost control (no secrets).
      if (completion.usage) {
        logger.info("ai.usage", "AI completion", {
          model: AI_CONFIG.model,
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          conversationId: context.conversationId,
        });
      }
    } catch (error) {
      // Never leak API keys / stack traces to the caller.
      logger.error("ai.provider", "AI request failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      throw new AiUnavailableError();
    }

    if (!content) {
      throw new AiUnavailableError("Empty response from AI provider");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      logger.error("ai.provider", "AI returned invalid JSON");
      throw new AiUnavailableError("Invalid AI response");
    }

    const parsed = modelOutputSchema.safeParse(parsedJson);
    if (!parsed.success) {
      logger.error("ai.provider", "AI response failed schema validation", {
        issues: parsed.error.issues.map((i) => i.path.join(".")),
      });
      throw new AiUnavailableError("Malformed AI response");
    }

    return mapModelOutput(parsed.data, context);
  }
}

/** Provider used when no AI is configured. Fails safely (no crash upstream). */
export class UnconfiguredAiProvider implements AiProvider {
  readonly name = "unconfigured-ai-provider";

  isConfigured(): boolean {
    return false;
  }

  async generate(_context: AgentContext): Promise<AgentResponse> {
    throw new AiUnavailableError(
      "Nenhum provedor de IA está configurado. Defina OPENAI_API_KEY.",
    );
  }
}

/**
 * Returns the currently configured AI provider. Centralized here so the
 * SalesAgent never needs to know which provider/model is in use.
 */
export function getAiProvider(): AiProvider {
  if (isAiConfigured() && env.OPENAI_API_KEY) {
    return new OpenAiProvider(env.OPENAI_API_KEY);
  }
  return new UnconfiguredAiProvider();
}
