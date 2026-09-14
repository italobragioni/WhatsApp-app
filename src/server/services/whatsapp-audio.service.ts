import { isSupportedAudioMime } from "@/server/ai/transcription/audio-format";
import { getTranscriptionProvider } from "@/server/ai/transcription/openai-transcription.provider";
import type { TranscriptionProvider } from "@/server/ai/transcription/types";
import { integrations } from "@/server/integrations";
import type { MessagingProvider, NormalizedInboundMessage } from "@/server/integrations/types";
import { getAudioMaxBytes } from "@/server/integrations/whatsapp/config";
import { logger } from "@/server/logger/logger";

/**
 * Audio → text step for the WhatsApp pipeline. Downloads the media (with a size
 * cap and timeout), transcribes it, and returns the text. It does NOT touch the
 * database, the SalesAgent, or send anything — the webhook service owns that.
 *
 * The audio Buffer is transient: it lives only for the duration of this call
 * and is never written to disk or persisted anywhere.
 */

export interface AudioMeta {
  mediaId: string | null;
  mimeType: string | null;
  waTimestamp: number | null;
  bytes?: number;
  downloadMs?: number;
  transcriptionMs?: number;
  totalMs?: number;
}

export type AudioResolution =
  | { status: "ok"; text: string; model: string; meta: AudioMeta }
  | {
      status:
        | "empty"
        | "too_large"
        | "unsupported_format"
        | "download_error"
        | "transcription_error"
        | "not_configured";
      meta: AudioMeta;
    };

export interface AudioDeps {
  provider?: MessagingProvider;
  transcriber?: TranscriptionProvider;
  maxBytes?: number;
}

export async function transcribeInboundAudio(
  message: NormalizedInboundMessage,
  deps: AudioDeps = {},
): Promise<AudioResolution> {
  const provider = deps.provider ?? integrations.messaging();
  const transcriber = deps.transcriber ?? getTranscriptionProvider();
  const maxBytes = deps.maxBytes ?? getAudioMaxBytes();

  const meta: AudioMeta = {
    mediaId: message.mediaId ?? null,
    mimeType: message.mimeType ?? null,
    waTimestamp: message.timestamp ?? null,
  };

  logger.info("whatsapp.audio", "received", {
    mediaId: meta.mediaId,
    mimeType: meta.mimeType,
  });

  if (!transcriber.isConfigured()) {
    logger.warn("whatsapp.audio", "transcription not configured");
    return { status: "not_configured", meta };
  }

  if (!message.mediaId) {
    logger.error("whatsapp.audio", "missing media id");
    return { status: "download_error", meta };
  }

  // Reject clearly-unsupported formats before spending a download.
  if (message.mimeType && !isSupportedAudioMime(message.mimeType)) {
    logger.warn("whatsapp.audio", "unsupported format", {
      mimeType: message.mimeType,
    });
    return { status: "unsupported_format", meta };
  }

  const started = Date.now();
  const dl = await provider.downloadMedia(message.mediaId, { maxBytes });
  meta.downloadMs = Date.now() - started;

  if (!dl.ok) {
    if (dl.code === "too_large") {
      logger.warn("whatsapp.audio", "audio too large", { maxBytes });
      return { status: "too_large", meta };
    }
    logger.error("whatsapp.audio", "download failed", { code: dl.code });
    return { status: "download_error", meta };
  }

  meta.bytes = dl.data.data.length;
  const effectiveMime = dl.data.mimeType || message.mimeType || "";
  logger.info("whatsapp.audio", "downloaded", {
    bytes: meta.bytes,
    mimeType: effectiveMime,
    downloadMs: meta.downloadMs,
  });

  if (!isSupportedAudioMime(effectiveMime)) {
    logger.warn("whatsapp.audio", "unsupported format (post-download)", {
      mimeType: effectiveMime,
    });
    return { status: "unsupported_format", meta };
  }

  logger.info("whatsapp.audio", "transcription.started", {});
  const t1 = Date.now();
  try {
    const result = await transcriber.transcribe({
      data: dl.data.data,
      mimeType: effectiveMime,
    });
    meta.transcriptionMs = Date.now() - t1;
    meta.totalMs = Date.now() - started;

    if (!result.text) {
      logger.info("whatsapp.audio", "transcription.completed (empty)", {
        transcriptionMs: meta.transcriptionMs,
      });
      return { status: "empty", meta };
    }

    // Log only the length of the transcription, never its content.
    logger.info("whatsapp.audio", "transcription.completed", {
      model: result.model,
      textLength: result.text.length,
      transcriptionMs: meta.transcriptionMs,
      totalMs: meta.totalMs,
    });
    return { status: "ok", text: result.text, model: result.model, meta };
  } catch (error) {
    meta.transcriptionMs = Date.now() - t1;
    logger.error("whatsapp.audio", "transcription.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { status: "transcription_error", meta };
  }
}
