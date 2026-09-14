import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/logzz-webhook.service", () => ({
  handleLogzzWebhookPayload: vi.fn().mockResolvedValue({ status: "ok" }),
}));

const { POST } = await import("@/app/api/webhooks/logzz/route");
const { handleLogzzWebhookPayload } = await import(
  "@/server/services/logzz-webhook.service"
);
const handler = vi.mocked(handleLogzzWebhookPayload);

const SECRET = "logzz-secret-test"; // matches vitest.config env
const base = "https://x/api/webhooks/logzz";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/webhooks/logzz", () => {
  it("processes a valid payload authenticated by token (query param)", async () => {
    const res = await POST(
      new Request(`${base}?token=${SECRET}`, {
        method: "POST",
        body: JSON.stringify({ order_id: "LZ-1", order_status: "Agendado" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects an invalid token with 401 and does not process", async () => {
    const res = await POST(
      new Request(`${base}?token=wrong`, {
        method: "POST",
        body: JSON.stringify({ order_id: "LZ-1", order_status: "Agendado" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("acks (200) and ignores a non-JSON body", async () => {
    const res = await POST(
      new Request(`${base}?token=${SECRET}`, {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(200);
    expect(handler).not.toHaveBeenCalled();
  });
});
