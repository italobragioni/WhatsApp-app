import crypto from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/whatsapp-webhook.service", () => ({
  handleWhatsAppWebhookPayload: vi.fn().mockResolvedValue({ received: 1 }),
}));

const { GET, POST } = await import("@/app/api/webhooks/whatsapp/route");
const { handleWhatsAppWebhookPayload } = await import(
  "@/server/services/whatsapp-webhook.service"
);
const handler = vi.mocked(handleWhatsAppWebhookPayload);

const APP_SECRET = "app-secret-test"; // matches vitest.config env
const VERIFY_TOKEN = "verify-token-test";

function sign(body: string): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex")
  );
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/webhooks/whatsapp (verification)", () => {
  it("echoes the challenge when the verify token matches", async () => {
    const url = `https://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=CHALLENGE123`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("CHALLENGE123");
  });

  it("rejects a wrong verify token", async () => {
    const url = `https://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=CHALLENGE123`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp", () => {
  const url = "https://x/api/webhooks/whatsapp";

  it("processes a valid, correctly-signed payload", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const res = await POST(
      new Request(url, {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": sign(body) },
      }),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects an invalid signature (401) and does not process", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const res = await POST(
      new Request(url, {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": "sha256=wrong" },
      }),
    );
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("acks (200) and ignores a non-JSON body", async () => {
    const body = "this is not json";
    const res = await POST(
      new Request(url, {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": sign(body) },
      }),
    );
    expect(res.status).toBe(200);
    expect(handler).not.toHaveBeenCalled();
  });
});
