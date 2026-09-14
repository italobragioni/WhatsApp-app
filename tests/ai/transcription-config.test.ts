import { describe, expect, it, vi } from "vitest";

// Override env for THIS file to prove the model is configurable and centralized.
vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
    OPENAI_TRANSCRIPTION_MODEL: "my-custom-transcribe-model",
  },
}));

const { TRANSCRIPTION_CONFIG, isTranscriptionConfigured, getTranscriptionStatus } =
  await import("@/server/ai/transcription/config");

describe("transcription config", () => {
  it("uses OPENAI_TRANSCRIPTION_MODEL when set (configurable)", () => {
    expect(TRANSCRIPTION_CONFIG.model).toBe("my-custom-transcribe-model");
  });

  it("is configured when an OpenAI key is present", () => {
    expect(isTranscriptionConfigured()).toBe(true);
    expect(getTranscriptionStatus()).toEqual({
      configured: true,
      model: "my-custom-transcribe-model",
    });
  });
});
