import { env } from "@/lib/env";

/**
 * Centralized transcription configuration — the ONLY place that reads
 * OPENAI_TRANSCRIPTION_MODEL. The model has a documented default and is
 * overridable via env. Transcription reuses OPENAI_API_KEY (no separate key).
 */

const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export const TRANSCRIPTION_CONFIG = {
  /** Transcription model; override with OPENAI_TRANSCRIPTION_MODEL. */
  model: env.OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_TRANSCRIPTION_MODEL,
  /** Hard timeout for a transcription request. */
  timeoutMs: 30_000,
  /** At most one controlled retry on transient errors. */
  maxRetries: 1,
} as const;

/** Transcription is available only when an OpenAI key is configured. */
export function isTranscriptionConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/** Safe status for the admin UI (never exposes the API key). */
export function getTranscriptionStatus(): {
  configured: boolean;
  model: string;
} {
  return {
    configured: isTranscriptionConfigured(),
    model: TRANSCRIPTION_CONFIG.model,
  };
}
