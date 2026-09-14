import { IntegrationProviderType } from "@prisma/client";

import {
  type DeliveryAddress,
  type DeliveryAvailability,
  type ExternalOrder,
  type ExternalOrderInput,
  type FulfillmentProvider,
  type IntegrationResult,
  NotImplementedError,
} from "../types";

/**
 * Logzz provider.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NOT CONNECTED YET. Contract implementation only.                     │
 * │  The real Logzz endpoints and payloads are unknown at this stage and  │
 * │  MUST NOT be invented. Method names below express intended            │
 * │  capabilities and will be adjusted against the official Logzz API     │
 * │  documentation when we implement the connection.                      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Critical rule reminder: information returned here is the ONLY source of
 * truth the AI agent may use for delivery dates, availability, and order
 * status. The agent must never invent these values.
 */
export class LogzzProvider implements FulfillmentProvider {
  readonly type = IntegrationProviderType.LOGZZ;
  readonly name = "Logzz";

  isConfigured(): boolean {
    // Real check will look for LOGZZ_API_BASE_URL / LOGZZ_API_KEY etc.
    return false;
  }

  async getDeliveryAvailability(
    _input: DeliveryAddress,
  ): Promise<IntegrationResult<DeliveryAvailability>> {
    throw new NotImplementedError(this.name, "getDeliveryAvailability");
  }

  async createOrder(
    _input: ExternalOrderInput,
  ): Promise<IntegrationResult<ExternalOrder>> {
    throw new NotImplementedError(this.name, "createOrder");
  }

  async getOrder(
    _externalId: string,
  ): Promise<IntegrationResult<ExternalOrder>> {
    throw new NotImplementedError(this.name, "getOrder");
  }

  async getOrderStatus(
    _externalId: string,
  ): Promise<IntegrationResult<{ status: string }>> {
    throw new NotImplementedError(this.name, "getOrderStatus");
  }

  verifyWebhookSignature(_input: {
    payload: string;
    signature: string | null;
  }): boolean {
    throw new NotImplementedError(this.name, "verifyWebhookSignature");
  }

  parseWebhook(_payload: unknown): { eventType: string; externalId?: string } {
    throw new NotImplementedError(this.name, "parseWebhook");
  }
}
