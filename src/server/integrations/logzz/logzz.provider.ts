import crypto from "node:crypto";

import { IntegrationProviderType } from "@prisma/client";

import {
  type DeliveryAddress,
  type DeliveryAvailability,
  type ExternalOrder,
  type ExternalOrderInput,
  type FulfillmentProvider,
  type IntegrationResult,
} from "../types";
import { getLogzzWebhookSecret, isLogzzWebhookConfigured } from "./config";
import {
  normalizeLogzzOrderEvent,
  type NormalizedLogzzOrderEvent,
} from "./webhook-schema";

/**
 * Logzz provider (real, minimal).
 *
 * Audit result (see ./config.ts): Logzz has NO public REST API to create
 * orders, pull order status, or query delivery availability. Those methods are
 * therefore reported as UNSUPPORTED — never faked. The confirmed, implemented
 * capabilities are: inbound order webhooks and checkout links (stored on the
 * product). Delivery availability/date/period are confirmed by the customer
 * INSIDE the Logzz checkout, not via an API call.
 */
const UNSUPPORTED = (method: string): IntegrationResult<never> => ({
  ok: false,
  code: "unsupported",
  error: `Logzz has no public API for "${method}". Use the checkout link + order webhook instead.`,
});

export class LogzzProvider implements FulfillmentProvider {
  readonly type = IntegrationProviderType.LOGZZ;
  readonly name = "Logzz";

  /** "Configured" means we can authenticate inbound webhooks. */
  isConfigured(): boolean {
    return isLogzzWebhookConfigured();
  }

  async getDeliveryAvailability(
    _input: DeliveryAddress,
  ): Promise<IntegrationResult<DeliveryAvailability>> {
    return UNSUPPORTED("getDeliveryAvailability");
  }

  async createOrder(
    _input: ExternalOrderInput,
  ): Promise<IntegrationResult<ExternalOrder>> {
    return UNSUPPORTED("createOrder");
  }

  async getOrder(
    _externalId: string,
  ): Promise<IntegrationResult<ExternalOrder>> {
    return UNSUPPORTED("getOrder");
  }

  async getOrderStatus(
    _externalId: string,
  ): Promise<IntegrationResult<{ status: string }>> {
    return UNSUPPORTED("getOrderStatus");
  }

  /**
   * Authenticate an inbound webhook using our shared secret token (Logzz
   * documents no signature mechanism, so the merchant embeds this token in the
   * configured webhook URL / header and we compare it here). `signature`
   * carries that token; `payload` is unused.
   */
  verifyWebhookSignature(input: {
    payload: string;
    signature: string | null;
  }): boolean {
    const secret = getLogzzWebhookSecret();
    if (!secret || !input.signature) return false;
    const a = Buffer.from(secret);
    const b = Buffer.from(input.signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /** Minimal interface impl: event type + external id. */
  parseWebhook(payload: unknown): { eventType: string; externalId?: string } {
    const event = normalizeLogzzOrderEvent(payload);
    if (!event) return { eventType: "unknown" };
    return { eventType: event.rawStatus, externalId: event.externalId };
  }

  /** Rich normalization used by the webhook service. */
  normalizeOrderEvent(payload: unknown): NormalizedLogzzOrderEvent | null {
    return normalizeLogzzOrderEvent(payload);
  }
}
