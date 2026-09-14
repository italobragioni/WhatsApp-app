import type { IntegrationProviderType, MessageType } from "@prisma/client";

/**
 * Integration abstraction layer.
 * -----------------------------------------------------------------------------
 * Contracts only. NO real external calls are implemented yet. Each concrete
 * provider (WhatsApp, Logzz) implements these interfaces and, until wired to a
 * real API, throws `NotImplementedError`. This lets the rest of the system be
 * built against stable contracts and swap in real implementations later without
 * touching business logic.
 */

/** Thrown by provider methods that are defined but not yet connected. */
export class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(
      `[${provider}] "${method}" is not implemented yet. ` +
        "This integration has no real connection configured.",
    );
    this.name = "NotImplementedError";
  }
}

/** Result wrapper so callers can handle failures without exceptions. */
export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** Base contract shared by every integration provider. */
export interface IntegrationProvider {
  /** Stable provider identifier used for logging and event tagging. */
  readonly type: IntegrationProviderType;
  /** Human-readable provider name. */
  readonly name: string;
  /** Whether the required credentials/config are present in the environment. */
  isConfigured(): boolean;
}

// -----------------------------------------------------------------------------
// Messaging (WhatsApp) contracts
// -----------------------------------------------------------------------------

/** Normalized inbound message, decoupled from any provider payload shape. */
export interface NormalizedInboundMessage {
  /** Provider-side unique id, used for idempotency. */
  externalId: string;
  /** Sender phone number in E.164 format. */
  from: string;
  type: MessageType;
  /** Text body or caption (empty for media without caption). */
  text?: string;
  /** Reference to media the provider stores, resolved lazily via downloadMedia. */
  mediaId?: string;
  mimeType?: string;
  /** Provider timestamp (epoch seconds) when available. */
  timestamp?: number;
  /** Raw provider payload for auditing/debugging. */
  raw: unknown;
}

export interface OutboundTextMessage {
  to: string;
  text: string;
}

export interface OutboundMediaMessage {
  to: string;
  mediaUrl: string;
  type: Extract<MessageType, "IMAGE" | "AUDIO" | "DOCUMENT">;
  caption?: string;
}

export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
}

/**
 * Messaging provider contract (implemented later by the WhatsApp Cloud API).
 */
export interface MessagingProvider extends IntegrationProvider {
  sendText(
    message: OutboundTextMessage,
  ): Promise<IntegrationResult<{ externalId: string }>>;

  sendMedia(
    message: OutboundMediaMessage,
  ): Promise<IntegrationResult<{ externalId: string }>>;

  downloadMedia(
    mediaId: string,
  ): Promise<IntegrationResult<DownloadedMedia>>;

  /** Verify the authenticity of an inbound webhook request. */
  verifyWebhookSignature(input: {
    payload: string;
    signature: string | null;
  }): boolean;

  /** Convert a raw webhook payload into normalized inbound messages. */
  parseInboundWebhook(payload: unknown): NormalizedInboundMessage[];
}

// -----------------------------------------------------------------------------
// Fulfillment / logistics (Logzz) contracts
// -----------------------------------------------------------------------------

export interface DeliveryAddress {
  postalCode: string;
  addressLine?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
}

export interface DeliveryOption {
  /** e.g. same-day, next-day, scheduled. */
  kind: "SAME_DAY" | "NEXT_DAY" | "SCHEDULED" | "UNAVAILABLE";
  /** Confirmed delivery date (ISO). Only present when the provider confirms it. */
  date?: string;
  /** Delivery fee in cents, when applicable. */
  feeCents?: number;
  label?: string;
}

export interface DeliveryAvailability {
  available: boolean;
  options: DeliveryOption[];
}

export interface ExternalOrderInput {
  productExternalRef?: string;
  customer: {
    name?: string;
    phone: string;
    email?: string;
  };
  address: DeliveryAddress;
  amountCents: number;
}

export interface ExternalOrder {
  externalId: string;
  status: string;
  checkoutUrl?: string;
  raw: unknown;
}

/**
 * Fulfillment provider contract (implemented later by Logzz).
 *
 * NOTE: These method names are placeholders that reflect the intended
 * capabilities. Exact endpoints/parameters will be defined against Logzz's
 * real API documentation when we implement the connection.
 */
export interface FulfillmentProvider extends IntegrationProvider {
  getDeliveryAvailability(
    input: DeliveryAddress,
  ): Promise<IntegrationResult<DeliveryAvailability>>;

  createOrder(
    input: ExternalOrderInput,
  ): Promise<IntegrationResult<ExternalOrder>>;

  getOrder(externalId: string): Promise<IntegrationResult<ExternalOrder>>;

  getOrderStatus(
    externalId: string,
  ): Promise<IntegrationResult<{ status: string }>>;

  verifyWebhookSignature(input: {
    payload: string;
    signature: string | null;
  }): boolean;

  parseWebhook(payload: unknown): {
    eventType: string;
    externalId?: string;
  };
}
