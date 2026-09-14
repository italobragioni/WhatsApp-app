import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * Only variables that are actually used today are required. Placeholders for
 * future integrations (WhatsApp, Logzz, AI provider) are intentionally left
 * out until those integrations are implemented.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  AUTH_SECRET: z
    .string()
    .min(16, { message: "AUTH_SECRET must be at least 16 characters" }),
  NEXTAUTH_URL: z.string().url().optional(),

  // -- AI provider (optional) --------------------------------------------------
  // When OPENAI_API_KEY is absent the agent degrades gracefully: the panel
  // shows a friendly "AI not configured" message instead of crashing.
  AI_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  // Audio transcription (reuses OPENAI_API_KEY; no separate key).
  OPENAI_TRANSCRIPTION_MODEL: z.string().min(1).optional(),

  // -- WhatsApp Business Platform / Cloud API (optional) -----------------------
  // Absent = integration "not configured": the app still runs, the webhook
  // answers verification, and the panel shows a "not configured" status.
  // These are read ONLY through src/server/integrations/whatsapp/config.ts.
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_API_VERSION: z.string().min(1).optional(),
  // App Secret enables X-Hub-Signature-256 verification of inbound webhooks
  // (recommended in production). Optional: without it the signature check is
  // skipped (a warning is logged) and only the verify-token handshake applies.
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  // Max size (bytes) of an inbound audio we will download/transcribe.
  WHATSAPP_AUDIO_MAX_BYTES: z.coerce.number().int().positive().optional(),

  // -- Logzz (optional) --------------------------------------------------------
  // Logzz has NO public REST API for creating orders or querying delivery/
  // status — integration is via panel-configured OUTBOUND webhooks + checkout
  // links. So there is intentionally NO LOGZZ_API_URL / LOGZZ_API_TOKEN.
  // Shared secret used to authenticate inbound Logzz webhook calls (our own
  // safeguard: the merchant embeds it in the configured webhook URL as ?token=
  // or sends it in the x-logzz-token header). Read ONLY via logzz/config.ts.
  LOGZZ_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Non-sensitive account identifier, for display only.
  LOGZZ_ACCOUNT_ID: z.string().min(1).optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables:\n${issues}\n` +
      "Copy .env.example to .env and fill in the required values.",
  );
}

export const env = parsed.data;
