import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * Only variables that are actually used today are required. Placeholders for
 * future integrations (WhatsApp, Logzz, AI provider) are intentionally left
 * out until those integrations are implemented.
 */

/**
 * Wrap an OPTIONAL variable's schema so that an empty/whitespace-only string is
 * treated as "not set" (undefined) BEFORE validation. This prevents a boot
 * failure when a hosting provider (e.g. Vercel) stores an optional variable as
 * an empty string `""` instead of leaving it absent. Real, non-empty values
 * still go through the original validation (min length, url, positive, ...).
 */
function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );
}

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Required — an empty value must fail (these are not optional).
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  AUTH_SECRET: z
    .string()
    .min(16, { message: "AUTH_SECRET must be at least 16 characters" }),
  NEXTAUTH_URL: optional(z.string().url()),

  // -- AI provider (optional) --------------------------------------------------
  // When OPENAI_API_KEY is absent the agent degrades gracefully: the panel
  // shows a friendly "AI not configured" message instead of crashing.
  AI_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: optional(z.string().min(1)),
  AI_MODEL: optional(z.string().min(1)),
  // Audio transcription (reuses OPENAI_API_KEY; no separate key).
  OPENAI_TRANSCRIPTION_MODEL: optional(z.string().min(1)),

  // -- WhatsApp Business Platform / Cloud API (optional) -----------------------
  // Absent = integration "not configured": the app still runs, the webhook
  // answers verification, and the panel shows a "not configured" status.
  // These are read ONLY through src/server/integrations/whatsapp/config.ts.
  WHATSAPP_ACCESS_TOKEN: optional(z.string().min(1)),
  WHATSAPP_PHONE_NUMBER_ID: optional(z.string().min(1)),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optional(z.string().min(1)),
  WHATSAPP_VERIFY_TOKEN: optional(z.string().min(1)),
  WHATSAPP_API_VERSION: optional(z.string().min(1)),
  // App Secret enables X-Hub-Signature-256 verification of inbound webhooks
  // (recommended in production). Optional: without it the signature check is
  // skipped (a warning is logged) and only the verify-token handshake applies.
  WHATSAPP_APP_SECRET: optional(z.string().min(1)),
  // Max size (bytes) of an inbound audio we will download/transcribe.
  WHATSAPP_AUDIO_MAX_BYTES: optional(z.coerce.number().int().positive()),

  // -- Logzz (optional) --------------------------------------------------------
  // Logzz has NO public REST API for creating orders or querying delivery/
  // status — integration is via panel-configured OUTBOUND webhooks + checkout
  // links. So there is intentionally NO LOGZZ_API_URL / LOGZZ_API_TOKEN.
  // Shared secret used to authenticate inbound Logzz webhook calls (our own
  // safeguard: the merchant embeds it in the configured webhook URL as ?token=
  // or sends it in the x-logzz-token header). Read ONLY via logzz/config.ts.
  LOGZZ_WEBHOOK_SECRET: optional(z.string().min(1)),
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
