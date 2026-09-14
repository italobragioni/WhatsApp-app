import { NextResponse } from "next/server";

import { integrations } from "@/server/integrations";
import { getAppSecret, getVerifyToken } from "@/server/integrations/whatsapp/config";
import { logger } from "@/server/logger/logger";
import { handleWhatsAppWebhookPayload } from "@/server/services/whatsapp-webhook.service";

// Needs the Node.js runtime (crypto + Prisma). Never statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Synchronous pipeline may include an AI call + media download/transcription;
// give the serverless function enough budget (Vercel reads this export).
export const maxDuration = 60;

/**
 * GET: Meta webhook verification handshake. Echoes hub.challenge only when the
 * hub.verify_token matches the configured WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = getVerifyToken();

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  logger.warn("webhook.whatsapp", "Verification challenge rejected");
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST: inbound events. Verifies the X-Hub-Signature-256 header (when an app
 * secret is configured), validates/parses the payload, hands off to the
 * webhook service, and acknowledges quickly with 200.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  // 1. Authenticity: verify signature when an app secret is configured.
  const appSecret = getAppSecret();
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    const valid = integrations
      .messaging()
      .verifyWebhookSignature({ payload: raw, signature });
    if (!valid) {
      logger.warn("webhook.whatsapp", "Rejected request with invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    logger.warn(
      "webhook.whatsapp",
      "Signature verification skipped (WHATSAPP_APP_SECRET not set)",
    );
  }

  // 2. Parse JSON. Invalid bodies are acknowledged (200) but not processed.
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    logger.warn("webhook.whatsapp", "Received non-JSON body");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // 3. Process (synchronous; see queue note in the webhook service). Errors are
  //    swallowed so we always ack — the service records them for diagnosis.
  try {
    const result = await handleWhatsAppWebhookPayload(payload);
    logger.info("webhook.whatsapp", "Webhook processed", {
      received: result.received,
    });
  } catch (err) {
    logger.error("webhook.whatsapp", "Unexpected webhook error", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
