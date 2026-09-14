import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSupportedAudioMime,
  mimeToExtension,
  normalizeMime,
} from "@/server/ai/transcription/audio-format";

// Mock the OpenAI SDK before importing the provider.
const { createMock, toFileMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  toFileMock: vi.fn(async (_data: unknown, name: string, opts: { type?: string }) => ({
    name,
    type: opts?.type,
  })),
}));

vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: createMock } };
    constructor(_opts: unknown) {}
  },
  toFile: toFileMock,
}));

const { OpenAiTranscriptionProvider } = await import(
  "@/server/ai/transcription/openai-transcription.provider"
);
const { TRANSCRIPTION_CONFIG } = await import("@/server/ai/transcription/config");
const { TranscriptionUnavailableError } = await import(
  "@/server/ai/transcription/types"
);

afterEach(() => vi.clearAllMocks());

describe("audio-format", () => {
  it("normalizes mime types (drops params, lowercases)", () => {
    expect(normalizeMime("audio/OGG; codecs=opus")).toBe("audio/ogg");
  });

  it("maps supported mime types to extensions", () => {
    expect(mimeToExtension("audio/ogg")).toBe("ogg");
    expect(mimeToExtension("audio/mpeg")).toBe("mp3");
    expect(isSupportedAudioMime("audio/ogg; codecs=opus")).toBe(true);
  });

  it("rejects unsupported formats", () => {
    expect(mimeToExtension("audio/amr")).toBeNull();
    expect(isSupportedAudioMime("audio/amr")).toBe(false);
  });
});

describe("OpenAiTranscriptionProvider", () => {
  it("uses the configured model (default fallback) and returns the text", async () => {
    createMock.mockResolvedValue({ text: "  olá mundo  " });
    const provider = new OpenAiTranscriptionProvider("k");

    const result = await provider.transcribe({
      data: Buffer.from("audio-bytes"),
      mimeType: "audio/ogg",
    });

    expect(result.text).toBe("olá mundo"); // trimmed
    expect(result.model).toBe(TRANSCRIPTION_CONFIG.model);
    expect(TRANSCRIPTION_CONFIG.model).toBe("gpt-4o-mini-transcribe"); // default
    const arg = createMock.mock.calls[0]![0] as { model: string; file: unknown };
    expect(arg.model).toBe(TRANSCRIPTION_CONFIG.model);
    expect(arg.file).toBeDefined();
    expect(toFileMock).toHaveBeenCalled();
  });

  it("returns empty text when the model transcribes nothing", async () => {
    createMock.mockResolvedValue({ text: "" });
    const provider = new OpenAiTranscriptionProvider("k");
    const result = await provider.transcribe({
      data: Buffer.from("x"),
      mimeType: "audio/ogg",
    });
    expect(result.text).toBe("");
  });

  it("throws a safe error (no token leak) on API failure", async () => {
    createMock.mockRejectedValue(new Error("api exploded key=sk-secret"));
    const provider = new OpenAiTranscriptionProvider("sk-secret");
    await expect(
      provider.transcribe({ data: Buffer.from("x"), mimeType: "audio/ogg" }),
    ).rejects.toBeInstanceOf(TranscriptionUnavailableError);
    // The typed error message never contains the key.
    await provider
      .transcribe({ data: Buffer.from("x"), mimeType: "audio/ogg" })
      .catch((e: Error) => expect(e.message).not.toContain("sk-secret"));
  });
});
