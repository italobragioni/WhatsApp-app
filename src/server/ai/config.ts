import { env } from "@/lib/env";

/**
 * Centralized AI configuration. The model is defined in ONE place and can be
 * overridden with the AI_MODEL environment variable — never hardcode it
 * elsewhere in the codebase.
 */
export const AI_CONFIG = {
  provider: env.AI_PROVIDER,
  /** Default model; override with AI_MODEL. */
  model: env.AI_MODEL ?? "gpt-4o-mini",
  /** Upper bound on completion tokens (cost control). */
  maxOutputTokens: 700,
  /** Lower temperature keeps the agent grounded and less prone to invention. */
  temperature: 0.4,
  /** How many recent messages to send to the model (context/cost control). */
  historyLimit: 20,
} as const;

export function isAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
