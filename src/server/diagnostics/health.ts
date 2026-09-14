import { env } from "@/lib/env";
import { AI_CONFIG, isAiConfigured } from "@/server/ai/config";
import { getTranscriptionStatus } from "@/server/ai/transcription/config";
import { getLogzzStatus } from "@/server/integrations/logzz/config";
import { getWhatsAppStatus } from "@/server/integrations/whatsapp/config";

/**
 * Integration diagnostics — CONFIGURATION ONLY.
 *
 * This inspects which credentials/settings are present. It performs NO external
 * calls and returns NO secret values (only booleans and non-sensitive labels
 * like the model name). Safe to render in the admin UI or read internally.
 */

export interface HealthCheck {
  key: string;
  label: string;
  configured: boolean;
  /** Non-sensitive detail (model name, masked id, ...). Never a secret. */
  detail?: string;
  /** Whether this must be configured for a production deployment. */
  requiredForProduction: boolean;
}

export interface SystemHealth {
  checks: HealthCheck[];
  productionReady: boolean;
}

export function getSystemHealth(): SystemHealth {
  const wa = getWhatsAppStatus();
  const transcription = getTranscriptionStatus();
  const logzz = getLogzzStatus();

  const checks: HealthCheck[] = [
    {
      key: "database",
      label: "Banco de dados",
      configured: Boolean(env.DATABASE_URL),
      requiredForProduction: true,
    },
    {
      key: "auth",
      label: "Autenticação (AUTH_SECRET)",
      configured: Boolean(env.AUTH_SECRET),
      requiredForProduction: true,
    },
    {
      key: "openai",
      label: "OpenAI (SalesAgent)",
      configured: isAiConfigured(),
      detail: `modelo: ${AI_CONFIG.model}`,
      requiredForProduction: true,
    },
    {
      key: "transcription",
      label: "Transcrição de áudio",
      configured: transcription.configured,
      detail: `modelo: ${transcription.model}`,
      // Optional: text still works without it; audio degrades gracefully.
      requiredForProduction: false,
    },
    {
      key: "whatsapp",
      label: "WhatsApp Cloud API",
      configured: wa.status === "configured",
      detail: wa.signatureVerification
        ? "assinatura ativa"
        : "assinatura inativa",
      requiredForProduction: true,
    },
    {
      key: "logzz",
      label: "Logzz (webhook)",
      configured: logzz.status === "configured",
      detail: logzz.signatureVerification ? "token ativo" : "token inativo",
      // Optional: the agent/checkout flow works; only order sync needs it.
      requiredForProduction: false,
    },
  ];

  const productionReady = checks
    .filter((c) => c.requiredForProduction)
    .every((c) => c.configured);

  return { checks, productionReady };
}
