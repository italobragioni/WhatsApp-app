import {
  IntegrationProviderType,
  OrderStatus,
  type Prisma,
} from "@prisma/client";

import { integrations } from "@/server/integrations";
import type { FulfillmentProvider } from "@/server/integrations/types";
import { mapLogzzStatus } from "@/server/integrations/logzz/status";
import type { NormalizedLogzzOrderEvent } from "@/server/integrations/logzz/webhook-schema";
import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";

import { upsertCustomerByPhone } from "./customer.service";

/**
 * Logzz webhook processing. Consumes the panel-configured OUTBOUND order
 * webhook and keeps our Order in sync. Idempotent by (externalId + rawStatus)
 * so a redelivery of the same status never double-processes.
 *
 * There is no Logzz API to call back — this is push-only, so no order is ever
 * created programmatically against Logzz here; we only mirror what Logzz sends.
 */

export interface LogzzDeps {
  provider?: FulfillmentProvider & {
    normalizeOrderEvent?: (p: unknown) => NormalizedLogzzOrderEvent | null;
  };
}

export type LogzzResult =
  | { status: "duplicate" }
  | { status: "invalid" }
  | { status: "skipped"; reason: "no_customer" }
  | { status: "ok"; orderId: string; created: boolean };

function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

export async function processLogzzOrderEvent(
  event: NormalizedLogzzOrderEvent,
): Promise<LogzzResult> {
  const idempotencyKey = `${event.externalId}:${event.rawStatus}`;

  // 1. Idempotency (same order + same status = same event).
  const existing = await prisma.integrationEvent.findUnique({
    where: {
      provider_externalId: {
        provider: IntegrationProviderType.LOGZZ,
        externalId: idempotencyKey,
      },
    },
  });
  if (existing?.processed) return { status: "duplicate" };

  let eventId = existing?.id;
  if (!existing) {
    try {
      const created = await prisma.integrationEvent.create({
        data: {
          provider: IntegrationProviderType.LOGZZ,
          eventType: event.rawStatus,
          externalId: idempotencyKey,
          direction: "inbound",
          payload: (event.raw ?? {}) as Prisma.InputJsonValue,
          processed: false,
        },
      });
      eventId = created.id;
    } catch {
      return { status: "duplicate" };
    }
  }

  try {
    const mapped = mapLogzzStatus(event.rawStatus);

    const deliveryData =
      event.deliveryDate || event.deliveryPeriod
        ? {
            date: event.deliveryDate ?? null,
            period: event.deliveryPeriod ?? null,
            confirmedBy: "logzz_checkout",
          }
        : undefined;

    const metadataExtra = {
      source: "logzz",
      rawStatus: event.rawStatus,
      quantity: event.quantity ?? null,
      productName: event.productName ?? null,
      updatedFromWebhookAt: new Date().toISOString(),
    };

    // 2. Match an existing order by external id.
    const order = await prisma.order.findFirst({
      where: { externalId: event.externalId },
    });

    if (order) {
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          ...(mapped ? { status: mapped } : {}),
          ...(event.amountCents != null ? { amountCents: event.amountCents } : {}),
          ...(deliveryData ? { deliveryData } : {}),
          metadata: mergeMetadata(order.metadata, metadataExtra),
        },
      });
      if (eventId) await markProcessed(eventId);
      logger.info("logzz.webhook", "Order updated", {
        orderId: updated.id,
        externalId: event.externalId,
        status: mapped ?? "unmapped",
      });
      return { status: "ok", orderId: updated.id, created: false };
    }

    // 3. No order yet: create one only if we can attach a customer.
    if (!event.customerPhone) {
      if (eventId) await markProcessed(eventId);
      logger.warn("logzz.webhook", "Order event without customer phone; recorded but not created", {
        externalId: event.externalId,
      });
      return { status: "skipped", reason: "no_customer" };
    }

    const customer = await upsertCustomerByPhone(
      event.customerPhone,
      event.customerName ? { name: event.customerName } : undefined,
    );

    const product = event.productExternalId
      ? await prisma.product.findFirst({
          where: { externalId: event.productExternalId },
        })
      : null;

    const createdOrder = await prisma.order.create({
      data: {
        customerId: customer.id,
        productId: product?.id ?? null,
        externalId: event.externalId,
        status: mapped ?? OrderStatus.PLACED,
        amountCents: event.amountCents ?? 0,
        deliveryData,
        metadata: metadataExtra,
      },
    });

    if (eventId) await markProcessed(eventId);
    logger.info("logzz.webhook", "Order created", {
      orderId: createdOrder.id,
      externalId: event.externalId,
      status: mapped ?? "unmapped",
    });
    return { status: "ok", orderId: createdOrder.id, created: true };
  } catch (err) {
    logger.error("logzz.webhook", "Processing failed", {
      externalId: event.externalId,
      message: err instanceof Error ? err.message : "unknown",
    });
    if (eventId) {
      await prisma.integrationEvent
        .update({
          where: { id: eventId },
          data: { error: err instanceof Error ? err.message : "unknown" },
        })
        .catch(() => undefined);
    }
    throw err;
  }
}

async function markProcessed(eventId: string): Promise<void> {
  await prisma.integrationEvent.update({
    where: { id: eventId },
    data: { processed: true, processedAt: new Date() },
  });
}

/** Parse + process a raw Logzz webhook payload. Used by the route. */
export async function handleLogzzWebhookPayload(
  payload: unknown,
  deps: LogzzDeps = {},
): Promise<LogzzResult> {
  const provider = deps.provider ?? integrations.fulfillment();
  const normalize =
    (provider as { normalizeOrderEvent?: (p: unknown) => NormalizedLogzzOrderEvent | null })
      .normalizeOrderEvent;
  const event = normalize ? normalize(payload) : null;
  if (!event) return { status: "invalid" };
  return processLogzzOrderEvent(event);
}
