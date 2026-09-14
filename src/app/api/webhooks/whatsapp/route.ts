import { NextResponse } from "next/server";

import { logger } from "@/server/logger/logger";

/**
 * WhatsApp webhook endpoint — PLACEHOLDER.
 *
 * NOT CONNECTED YET. This route exists so the URL is stable, but it does not
 * process real events. When we wire the WhatsApp Cloud API, this handler will:
 *   1. (GET) answer the Meta verification challenge using WHATSAPP_VERIFY_TOKEN.
 *   2. (POST) verify the signature, persist an IntegrationEvent for idempotency,
 *      normalize messages via the MessagingProvider, and dispatch to the agent.
 */

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: "not_implemented", message: "WhatsApp webhook not connected." },
    { status: 501 },
  );
}

export async function POST(): Promise<NextResponse> {
  logger.warn("webhook.whatsapp", "Received request but integration is not connected");
  return NextResponse.json(
    { status: "not_implemented", message: "WhatsApp webhook not connected." },
    { status: 501 },
  );
}
