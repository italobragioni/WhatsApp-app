import { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isLogzzWebhookConfigured, LOGZZ_CAPABILITIES } from "@/server/integrations/logzz/config";
import { mapLogzzStatus } from "@/server/integrations/logzz/status";
import { normalizeLogzzOrderEvent } from "@/server/integrations/logzz/webhook-schema";
import { LogzzProvider } from "@/server/integrations/logzz/logzz.provider";

const SECRET = "logzz-secret-test"; // matches vitest.config env

describe("logzz config", () => {
  it("is configured when the webhook secret is set", () => {
    expect(isLogzzWebhookConfigured()).toBe(true);
  });

  it("advertises only confirmed capabilities (no fake API)", () => {
    expect(LOGZZ_CAPABILITIES.webhook).toBe(true);
    expect(LOGZZ_CAPABILITIES.checkoutUrl).toBe(true);
    expect(LOGZZ_CAPABILITIES.createOrderApi).toBe(false);
    expect(LOGZZ_CAPABILITIES.deliveryAvailabilityApi).toBe(false);
    expect(LOGZZ_CAPABILITIES.orderStatusPullApi).toBe(false);
  });
});

describe("mapLogzzStatus (documented statuses only)", () => {
  it("maps known statuses", () => {
    expect(mapLogzzStatus("Agendado")).toBe(OrderStatus.PLACED);
    expect(mapLogzzStatus("A Reagendar")).toBe(OrderStatus.PLACED);
    expect(mapLogzzStatus("Em Separação")).toBe(OrderStatus.CONFIRMED);
    expect(mapLogzzStatus("Em Rota")).toBe(OrderStatus.SHIPPED);
    expect(mapLogzzStatus("A Caminho")).toBe(OrderStatus.SHIPPED);
    expect(mapLogzzStatus("Entregue")).toBe(OrderStatus.DELIVERED);
    expect(mapLogzzStatus("Cancelado")).toBe(OrderStatus.CANCELLED);
    expect(mapLogzzStatus("Frustrado")).toBe(OrderStatus.RETURNED);
  });

  it("returns null for an unknown status (never guesses)", () => {
    expect(mapLogzzStatus("Alguma coisa nova")).toBeNull();
  });
});

describe("normalizeLogzzOrderEvent", () => {
  it("normalizes canonical keys", () => {
    const event = normalizeLogzzOrderEvent({
      order_id: "LZ-123",
      order_status: "Agendado",
      customer_name: "João",
      customer_phone: "+5511999999999",
      product_id: "P1",
      order_quantity: "2",
      order_amount: "49,90",
      delivery_date: "2026-09-15",
      delivery_period: "manhã",
    });
    expect(event).toMatchObject({
      externalId: "LZ-123",
      rawStatus: "Agendado",
      customerName: "João",
      customerPhone: "+5511999999999",
      productExternalId: "P1",
      quantity: 2,
      amountCents: 4990,
      deliveryDate: "2026-09-15",
      deliveryPeriod: "manhã",
    });
  });

  it("accepts documented fallback field names (cliente_name, order_quantity)", () => {
    const event = normalizeLogzzOrderEvent({
      id: 555,
      status: "Entregue",
      cliente_name: "Maria",
      order_quantity: 1,
    });
    expect(event?.externalId).toBe("555");
    expect(event?.customerName).toBe("Maria");
    expect(event?.quantity).toBe(1);
  });

  it("returns null without an external id or status", () => {
    expect(normalizeLogzzOrderEvent({ customer_name: "x" })).toBeNull();
    expect(normalizeLogzzOrderEvent("garbage")).toBeNull();
  });
});

describe("LogzzProvider", () => {
  const provider = new LogzzProvider();

  it("reports unsupported for capabilities Logzz has no API for", async () => {
    expect((await provider.createOrder({} as never)).ok).toBe(false);
    expect((await provider.getOrder("x")).ok).toBe(false);
    expect((await provider.getOrderStatus("x")).ok).toBe(false);
    expect((await provider.getDeliveryAvailability({} as never)).ok).toBe(false);
    const res = await provider.createOrder({} as never);
    if (!res.ok) expect(res.code).toBe("unsupported");
  });

  it("verifies the shared webhook token", () => {
    expect(
      provider.verifyWebhookSignature({ payload: "{}", signature: SECRET }),
    ).toBe(true);
    expect(
      provider.verifyWebhookSignature({ payload: "{}", signature: "wrong" }),
    ).toBe(false);
    expect(
      provider.verifyWebhookSignature({ payload: "{}", signature: null }),
    ).toBe(false);
  });

  it("parses a webhook into eventType + externalId", () => {
    const parsed = provider.parseWebhook({
      order_id: "LZ-9",
      order_status: "Entregue",
    });
    expect(parsed).toEqual({ eventType: "Entregue", externalId: "LZ-9" });
  });
});
