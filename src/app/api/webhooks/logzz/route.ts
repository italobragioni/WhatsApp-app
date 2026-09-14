import { NextResponse } from "next/server";

import { logger } from "@/server/logger/logger";

/**
 * Logzz webhook endpoint — PLACEHOLDER.
 *
 * NOT CONNECTED YET. When implemented against the real Logzz API, this handler
 * will verify the signature, persist an IntegrationEvent, and update the local
 * Order status accordingly. No endpoints or payloads are assumed here.
 */
export async function POST(): Promise<NextResponse> {
  logger.warn("webhook.logzz", "Received request but integration is not connected");
  return NextResponse.json(
    { status: "not_implemented", message: "Logzz webhook not connected." },
    { status: 501 },
  );
}
