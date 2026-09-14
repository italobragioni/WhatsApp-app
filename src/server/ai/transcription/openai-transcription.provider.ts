import OpenAI, { toFile } from "openai";

import { env } from "@/lib/env";
import { logger } from "@/server/logger/logger";

import { mimeToExtension } from "./audio-format";
import { TRANSCRIPTION_CONFIG, isTranscriptionConfigured } from "./config";
import {
  type TranscriptionInput,
  type TranscriptionProvider,
  type TranscriptionResult,
  TranscriptionUnavailableError,
} from "./types";

/**
 * OpenAI speech-to-text provider using the official SDK
 * (`client.audio.transcriptions.create`). The audio Buffer is wrapped with the
 * SDK's `toFile` helper — nothing is written to disk. The model is taken from
 * the centralized transcription config.
 */
export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      timeout: TRANSCRIPTION_CONFIG.timeoutMs,
      maxRetries: TRANSCRIPTION_CONFIG.maxRetries,
    });
  }

  isConfigured(): boolean {
    return true;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const ext = mimeToExtension(input.mimeType) ?? "ogg";
    try {
      const file = await toFile(input.data, `audio.${ext}`, {
        type: input.mimeType,
      });
      const result = await this.client.audio.transcriptions.create({
        file,
        model: TRANSCRIPTION_CONFIG.model,
        response_format: "json",
      });
      return {
        text: (result.text ?? "").trim(),
        model: TRANSCRIPTION_CONFIG.model,
      };
    } catch (error) {
      // Never leak the API key or a stack trace to callers/logs.
      logger.error("ai.transcription", "Transcription request failed", {
        model: TRANSCRIPTION_CONFIG.model,
        message: error instanceof Error ? error.message : "unknown",
      });
      throw new TranscriptionUnavailableError();
    }
  }
}

/** Provider used when transcription is not configured. Fails safely. */
export class UnconfiguredTranscriptionProvider implements TranscriptionProvider {
  readonly name = "unconfigured-transcription-provider";

  isConfigured(): boolean {
    return false;
  }

  async transcribe(): Promise<TranscriptionResult> {
    throw new TranscriptionUnavailableError(
      "Transcrição não configurada. Defina OPENAI_API_KEY.",
    );
  }
}

/** Returns the currently configured transcription provider. */
export function getTranscriptionProvider(): TranscriptionProvider {
  if (isTranscriptionConfigured() && env.OPENAI_API_KEY) {
    return new OpenAiTranscriptionProvider(env.OPENAI_API_KEY);
  }
  return new UnconfiguredTranscriptionProvider();
}
