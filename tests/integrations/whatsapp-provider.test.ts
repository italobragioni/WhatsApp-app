import crypto from "node:crypto";

import { MessageType } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppConfig } from "@/server/integrations/whatsapp/config";
import { WhatsAppProvider } from "@/server/integrations/whatsapp/whatsapp.provider";

const APP_SECRET = "app-secret-test"; // matches vitest.config env

const fakeConfig: WhatsAppConfig = {
  accessToken: "SECRET-TOKEN-DO-NOT-LEAK",
  phoneNumberId: "111222333",
  apiVersion: "v21.0",
  graphHost: "https://graph.facebook.com",
};

function textPayload(overrides?: {
  from?: string;
  id?: string;
  name?: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "111222333" },
              contacts: [
                {
                  wa_id: overrides?.from ?? "5511999999999",
                  profile: { name: overrides?.name ?? "João" },
                },
              ],
              messages: [
                {
                  from: overrides?.from ?? "5511999999999",
                  id: overrides?.id ?? "wamid.ABC",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Olá, tudo bem?" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WhatsAppProvider.parseInboundWebhook", () => {
  const provider = new WhatsAppProvider(fakeConfig);

  it("normalizes a text message", () => {
    const [msg] = provider.parseInboundWebhook(textPayload());
    expect(msg).toMatchObject({
      externalId: "wamid.ABC",
      from: "5511999999999",
      contactName: "João",
      type: MessageType.TEXT,
      text: "Olá, tudo bem?",
    });
  });

  it("ignores status-only events (loop guard)", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [{ id: "wamid.OUT", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(provider.parseInboundWebhook(payload)).toEqual([]);
  });

  it("maps an audio message as unsupported media (keeps media id)", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: "5511999999999",
                    id: "wamid.AUDIO",
                    type: "audio",
                    audio: { id: "media-1", mime_type: "audio/ogg" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const msg = provider.parseInboundWebhook(payload)[0]!;
    expect(msg.type).toBe(MessageType.AUDIO);
    expect(msg.mediaId).toBe("media-1");
    expect(msg.mimeType).toBe("audio/ogg");
  });

  it("returns [] for an invalid payload", () => {
    expect(provider.parseInboundWebhook({ nope: true })).toEqual([]);
    expect(provider.parseInboundWebhook("garbage")).toEqual([]);
  });
});

describe("WhatsAppProvider.verifyWebhookSignature", () => {
  const provider = new WhatsAppProvider(fakeConfig);

  it("accepts a correct signature", () => {
    const body = JSON.stringify({ hello: "world" });
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
    expect(provider.verifyWebhookSignature({ payload: body, signature: sig })).toBe(
      true,
    );
  });

  it("rejects a wrong signature and a missing one", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(
      provider.verifyWebhookSignature({ payload: body, signature: "sha256=deadbeef" }),
    ).toBe(false);
    expect(
      provider.verifyWebhookSignature({ payload: body, signature: null }),
    ).toBe(false);
  });
});

describe("WhatsAppProvider.sendText", () => {
  it("sends and returns the provider message id", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.SENT" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new WhatsAppProvider(fakeConfig);
    const result = await provider.sendText({ to: "5511", text: "oi" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.externalId).toBe("wamid.SENT");

    const call = mockFetch.mock.calls[0]!;
    const [url, init] = call as [string, RequestInit];
    expect(url).toContain("/v21.0/111222333/messages");
    expect((init.headers as Record<string, string>).Authorization).toContain(
      "Bearer",
    );
  });

  it("returns a safe error and never leaks the token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Invalid token", code: 190 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = new WhatsAppProvider(fakeConfig);
    const result = await provider.sendText({ to: "5511", text: "oi" });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("SECRET-TOKEN-DO-NOT-LEAK");
  });

  it("returns not_configured when there is no config", async () => {
    const provider = new WhatsAppProvider(null);
    const result = await provider.sendText({ to: "5511", text: "oi" });
    expect(result.ok).toBe(false);
  });
});
