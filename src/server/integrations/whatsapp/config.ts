import { env } from "@/lib/env";

/**
 * WhatsApp Cloud API configuration — the SINGLE place that reads WHATSAPP_*
 * env vars. Nothing else in the codebase touches process.env for WhatsApp.
 *
 * Official Graph API host and message endpoint shape are documented by Meta:
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const DEFAULT_API_VERSION = "v21.0";
const GRAPH_HOST = "https://graph.facebook.com";
/** Default cap for inbound audio downloads (WhatsApp media limit is ~16MB). */
const DEFAULT_AUDIO_MAX_BYTES = 16 * 1024 * 1024;

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  verifyToken?: string;
  appSecret?: string;
  apiVersion: string;
  graphHost: string;
}

/** True when the minimum needed to SEND messages is present. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Returns the full config, or null when not configured. Callers that send
 * messages must handle null (integration disabled) gracefully.
 */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  if (!isWhatsAppConfigured()) return null;
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN as string,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    appSecret: env.WHATSAPP_APP_SECRET,
    apiVersion: env.WHATSAPP_API_VERSION ?? DEFAULT_API_VERSION,
    graphHost: GRAPH_HOST,
  };
}

/** The configured verify token (for the GET webhook handshake), if any. */
export function getVerifyToken(): string | undefined {
  return env.WHATSAPP_VERIFY_TOKEN;
}

/** The app secret used for inbound signature verification, if configured. */
export function getAppSecret(): string | undefined {
  return env.WHATSAPP_APP_SECRET;
}

/** Max bytes we will download/transcribe for an inbound audio message. */
export function getAudioMaxBytes(): number {
  return env.WHATSAPP_AUDIO_MAX_BYTES ?? DEFAULT_AUDIO_MAX_BYTES;
}

/** Mask a sensitive id, showing only the last 4 characters. */
function maskTail(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export type WhatsAppStatus = "not_configured" | "configured";

/**
 * Safe, non-secret status for the admin UI. NEVER returns tokens/secrets — only
 * a masked Phone Number ID and which required variables are missing.
 */
export function getWhatsAppStatus(): {
  status: WhatsAppStatus;
  phoneNumberIdMasked?: string;
  signatureVerification: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!env.WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!env.WHATSAPP_VERIFY_TOKEN) missing.push("WHATSAPP_VERIFY_TOKEN");

  return {
    status: isWhatsAppConfigured() ? "configured" : "not_configured",
    phoneNumberIdMasked: env.WHATSAPP_PHONE_NUMBER_ID
      ? maskTail(env.WHATSAPP_PHONE_NUMBER_ID)
      : undefined,
    signatureVerification: Boolean(env.WHATSAPP_APP_SECRET),
    missing,
  };
}
