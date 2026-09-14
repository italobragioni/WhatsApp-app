import { MessageType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MessagingProvider, NormalizedInboundMessage } from "@/server/integrations/types";
import type { TranscriptionProvider } from "@/server/ai/transcription/types";
import { transcribeInboundAudio } from "@/server/services/whatsapp-audio.service";

function audioMessage(overrides: Partial<NormalizedInboundMessage> = {}): NormalizedInboundMessage {
  return {
    externalId: "wamid.AUDIO",
    from: "5511999999999",
    type: MessageType.AUDIO,
    mediaId: "media-1",
    mimeType: "audio/ogg",
    raw: {},
    ...overrides,
  };
}

function makeProvider(download: unknown) {
  return {
    name: "mock",
    downloadMedia: vi.fn().mockResolvedValue(download),
    sendText: vi.fn(),
    sendMedia: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    parseInboundWebhook: vi.fn(),
    isConfigured: () => true,
  } as unknown as MessagingProvider & { downloadMedia: ReturnType<typeof vi.fn> };
}

function makeTranscriber(
  behavior: { text?: string; throws?: boolean; configured?: boolean } = {},
) {
  return {
    name: "mock-transcriber",
    isConfigured: () => behavior.configured ?? true,
    transcribe: behavior.throws
      ? vi.fn().mockRejectedValue(new Error("boom"))
      : vi.fn().mockResolvedValue({ text: behavior.text ?? "oi", model: "m" }),
  } as unknown as TranscriptionProvider & { transcribe: ReturnType<typeof vi.fn> };
}

const okDownload = {
  ok: true,
  data: { data: Buffer.from("audio"), mimeType: "audio/ogg" },
};

beforeEach(() => vi.clearAllMocks());

describe("transcribeInboundAudio", () => {
  it("downloads and transcribes successfully", async () => {
    const provider = makeProvider(okDownload);
    const transcriber = makeTranscriber({ text: "vocês entregam hoje?" });

    const res = await transcribeInboundAudio(audioMessage(), {
      provider,
      transcriber,
      maxBytes: 1000,
    });

    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.text).toBe("vocês entregam hoje?");
    // download is called with the size cap
    expect(provider.downloadMedia).toHaveBeenCalledWith("media-1", { maxBytes: 1000 });
  });

  it("returns empty when the transcription has no text", async () => {
    const res = await transcribeInboundAudio(audioMessage(), {
      provider: makeProvider(okDownload),
      transcriber: makeTranscriber({ text: "" }),
    });
    expect(res.status).toBe("empty");
  });

  it("returns download_error when the download fails", async () => {
    const res = await transcribeInboundAudio(audioMessage(), {
      provider: makeProvider({ ok: false, code: "network", error: "x" }),
      transcriber: makeTranscriber(),
    });
    expect(res.status).toBe("download_error");
  });

  it("returns too_large when the media exceeds the limit", async () => {
    const res = await transcribeInboundAudio(audioMessage(), {
      provider: makeProvider({ ok: false, code: "too_large", error: "x" }),
      transcriber: makeTranscriber(),
    });
    expect(res.status).toBe("too_large");
  });

  it("returns unsupported_format for a non-audio mime (without downloading)", async () => {
    const provider = makeProvider(okDownload);
    const res = await transcribeInboundAudio(
      audioMessage({ mimeType: "audio/amr" }),
      { provider, transcriber: makeTranscriber() },
    );
    expect(res.status).toBe("unsupported_format");
    expect(provider.downloadMedia).not.toHaveBeenCalled();
  });

  it("returns transcription_error when transcription throws", async () => {
    const res = await transcribeInboundAudio(audioMessage(), {
      provider: makeProvider(okDownload),
      transcriber: makeTranscriber({ throws: true }),
    });
    expect(res.status).toBe("transcription_error");
  });

  it("returns not_configured when transcription is unavailable (no download)", async () => {
    const provider = makeProvider(okDownload);
    const res = await transcribeInboundAudio(audioMessage(), {
      provider,
      transcriber: makeTranscriber({ configured: false }),
    });
    expect(res.status).toBe("not_configured");
    expect(provider.downloadMedia).not.toHaveBeenCalled();
  });
});
