/**
 * Maps audio MIME types to file extensions accepted by the transcription API.
 * WhatsApp voice notes arrive as audio/ogg (opus). We never trust a
 * client-supplied filename — the extension is derived from the MIME type.
 *
 * OpenAI transcription accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav,
 * webm. A MIME type outside this map is treated as unsupported.
 */
const MIME_TO_EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/oga": "oga",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpga": "mpga",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

/** Normalize a MIME type: drop parameters (e.g. "; codecs=opus") and lowercase. */
export function normalizeMime(mimeType: string): string {
  return mimeType.split(";")[0]!.trim().toLowerCase();
}

/** Returns the file extension for a MIME type, or null if unsupported. */
export function mimeToExtension(mimeType: string): string | null {
  return MIME_TO_EXT[normalizeMime(mimeType)] ?? null;
}

/** Whether the given MIME type is a transcription-supported audio format. */
export function isSupportedAudioMime(mimeType: string): boolean {
  return mimeToExtension(mimeType) !== null;
}
