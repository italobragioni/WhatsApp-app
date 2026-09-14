import { NextResponse } from "next/server";

import { integrations } from "@/server/integrations";
import { getLogzzWebhookSecret } from "@/server/integrations/logzz/config";
import { logger } from "@/server/logger/logger";
import { handleLogzzWebhookPayload } from "@/server/services/logzz-webhook.service";

// Needs the Node.js runtime (crypto + Prisma). Never statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Logzz order webhook (panel-configured, outbound from Logzz).
 *
 * Authentication: Logzz documents no signature mechanism, so we protect this
 * endpoint with a shared token the merchant embeds in the configured webhook
 * URL (`?token=...`) or the `x-logzz-token` header, compared against
 * LOGZZ_WEBHOOK_SECRET. Without a configured secret the check is skipped (a
 * warning is logged). The handler validates the payload, updates the Order
 * idempotently, and always acks quickly with 200.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  const secret = getLogzzWebhookSecret();
  if (secret) {
    const url = new URL(request.url);
    const token =
      url.searchParams.get("token") ?? request.headers.get("x-logzz-token");
    const valid = integrations
      .fulfillment()
      .verifyWebhookSignature({ payload: raw, signature: token });
    if (!valid) {
      logger.warn("webhook.logzz", "Rejected request with invalid token");
      return new Response("Invalid token", { status: 401 });
    }
  } else {
    logger.warn(
      "webhook.logzz",
      "Token verification skipped (LOGZZ_WEBHOOK_SECRET not set)",
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    logger.warn("webhook.logzz", "Received non-JSON body");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  try {
    const result = await handleLogzzWebhookPayload(payload);
    logger.info("webhook.logzz", "Webhook processed", { result: result.status });
  } catch (err) {
    logger.error("webhook.logzz", "Unexpected webhook error", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
