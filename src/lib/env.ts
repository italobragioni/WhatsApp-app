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
