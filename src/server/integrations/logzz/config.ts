import { env } from "@/lib/env";

/**
 * Logzz configuration — the SINGLE place that reads LOGZZ_* env vars.
 *
 * IMPORTANT (audit result): Logzz does NOT expose a public REST API for
 * creating orders, pulling order status, or querying delivery availability by
 * CEP. The integration is:
 *   - OUTBOUND webhooks (panel-configured; the merchant maps order fields and
 *     sets the destination URL) — https://blog.logzz.com.br/webhooks/
 *   - Checkout links via Offers ("Checkout Personalizado"), created in the
 *     Logzz panel; the customer fills the address and chooses the available
 *     delivery day/period INSIDE the checkout.
 *
 * Therefore there is NO api url/token here. The only secret is a shared token
 * used to authenticate inbound webhook calls to OUR endpoint (Logzz itself
 * documents no signature mechanism, so we protect the endpoint ourselves).
 */

export interface LogzzConfig {
  webhookSecret?: string;
}

export function getLogzzConfig(): LogzzConfig {
  return {
    webhookSecret: env.LOGZZ_WEBHOOK_SECRET,
  };
}

/** The shared secret used to authenticate inbound Logzz webhooks, if set. */
export function getLogzzWebhookSecret(): string | undefined {
  return env.LOGZZ_WEBHOOK_SECRET;
}

/** True when the inbound webhook can be authenticated (secret configured). */
export function isLogzzWebhookConfigured(): boolean {
  return Boolean(env.LOGZZ_WEBHOOK_SECRET);
}

/**
 * Capabilities actually implemented, kept honest for the admin UI. Anything not
 * offered by Logzz officially is marked unsupported — never faked.
 */
export const LOGZZ_CAPABILITIES = {
  webhook: true,
  checkoutUrl: true,
  createOrderApi: false,
  orderStatusPullApi: false,
  deliveryAvailabilityApi: false,
} as const;

export type LogzzStatus = "configured" | "not_configured";

/** Safe status for the admin UI. Never exposes the secret. */
export function getLogzzStatus(): {
  status: LogzzStatus;
  signatureVerification: boolean;
  capabilities: typeof LOGZZ_CAPABILITIES;
} {
  return {
    status: isLogzzWebhookConfigured() ? "configured" : "not_configured",
    signatureVerification: isLogzzWebhookConfigured(),
    capabilities: LOGZZ_CAPABILITIES,
  };
}
