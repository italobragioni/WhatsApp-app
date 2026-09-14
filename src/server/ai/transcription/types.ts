/**
 * Transcription abstraction. Keeps the rest of the app decoupled from the
 * concrete speech-to-text SDK (OpenAI today).
 */

export interface TranscriptionInput {
  /** Raw audio bytes (temporary; never persisted to disk). */
  data: Buffer;
  /** Source MIME type (e.g. "audio/ogg"), used to pick a filename/extension. */
  mimeType: string;
}

export interface TranscriptionResult {
  text: string;
  model: string;
  metadata?: Record<string, unknown>;
}

/** Raised when transcription cannot be performed (unconfigured or API error). */
export class TranscriptionUnavailableError extends Error {
  constructor(message = "Transcription provider is not available") {
    super(message);
    this.name = "TranscriptionUnavailableError";
  }
}

export interface TranscriptionProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** @throws {TranscriptionUnavailableError} on failure. */
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
