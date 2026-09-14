import crypto from "node:crypto";

import { IntegrationProviderType, MessageType } from "@prisma/client";

import { logger } from "@/server/logger/logger";

import {
  type DownloadedMedia,
  type IntegrationResult,
  type MessagingProvider,
  type NormalizedInboundMessage,
  type OutboundMediaMessage,
  type OutboundTextMessage,
} from "../types";
import { WhatsAppClient } from "./client";
import {
  getAppSecret,
  getWhatsAppConfig,
  isWhatsAppConfigured,
  type WhatsAppConfig,
} from "./config";
import { webhookPayloadSchema } from "./webhook-schema";

const NOT_CONFIGURED: IntegrationResult<never> = {
  ok: false,
  error: "WhatsApp integration is not configured",
  code: "not_configured",
};

/** Map a WhatsApp message type to our MessageType enum + whether we handle it. */
function mapMessageType(type: string): {
  mtype: MessageType;
  supported: boolean;
} {
  switch (type) {
    case "text":
      return { mtype: MessageType.TEXT, supported: true };
    case "audio":
    case "voice":
      return { mtype: MessageType.AUDIO, supported: false };
    case "image":
      return { mtype: MessageType.IMAGE, supported: false };
    case "document":
      return { mtype: MessageType.DOCUMENT, supported: false };
    case "location":
      return { mtype: MessageType.LOCATION, supported: false };
    default:
      // video, sticker, contacts, interactive, button, reaction, unknown...
      return { mtype: MessageType.SYSTEM, supported: false };
  }
}

/**
 * WhatsApp Cloud API provider. Implements the MessagingProvider contract using
 * Meta's official Graph API via {@link WhatsAppClient}. All HTTP details live in
 * the client; the SalesAgent/business layer only ever sees this interface.
 */
export class WhatsAppProvider implements MessagingProvider {
  readonly type = IntegrationProviderType.WHATSAPP;
  readonly name = "WhatsApp Cloud API";
  private readonly config: WhatsAppConfig | null;
  private readonly client: WhatsAppClient | null;

  constructor(config: WhatsAppConfig | null = getWhatsAppConfig()) {
    this.config = config;
    this.client = config ? new WhatsAppClient(config) : null;
  }

  isConfigured(): boolean {
    return isWhatsAppConfigured();
  }

  async sendText(
    message: OutboundTextMessage,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    if (!this.client) return NOT_CONFIGURED;
    return this.client.sendText(message.to, message.text);
  }

  async sendMedia(
    message: OutboundMediaMessage,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    if (!this.client) return NOT_CONFIGURED;
    const type =
      message.type === "IMAGE"
        ? "image"
        : message.type === "AUDIO"
          ? "audio"
          : "document";
    return this.client.sendMediaByLink(
      message.to,
      type,
      message.mediaUrl,
      message.caption,
    );
  }

  async downloadMedia(
    mediaId: string,
    options?: { maxBytes?: number },
  ): Promise<IntegrationResult<DownloadedMedia>> {
    if (!this.client) return NOT_CONFIGURED;
    return this.client.downloadMedia(mediaId, options?.maxBytes);
  }

  /**
   * Verify the X-Hub-Signature-256 header against the raw request body using
   * the app secret (HMAC-SHA256). Returns false if no app secret is configured
   * or the signature is missing/mismatched.
   */
  verifyWebhookSignature(input: {
    payload: string;
    signature: string | null;
  }): boolean {
    const appSecret = getAppSecret();
    if (!appSecret || !input.signature) return false;

    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", appSecret)
        .update(input.payload, "utf8")
        .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(input.signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Normalize an inbound webhook payload into a channel-agnostic list of
   * messages. Only `messages` are returned; `statuses` (delivery/read receipts
   * for our own outbound messages) are ignored — this is a key loop guard.
   * Invalid payloads yield an empty list (never throws).
   */
  parseInboundWebhook(payload: unknown): NormalizedInboundMessage[] {
    const parsed = webhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("whatsapp.provider", "Discarded invalid webhook payload");
      return [];
    }

    const out: NormalizedInboundMessage[] = [];
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;
        const value = change.value;
        if (!value.messages?.length) continue; // statuses-only change -> skip

        const nameByWaId = new Map<string, string>();
        for (const contact of value.contacts ?? []) {
          if (contact.wa_id && contact.profile?.name) {
            nameByWaId.set(contact.wa_id, contact.profile.name);
          }
        }

        for (const raw of value.messages) {
          const { mtype } = mapMessageType(raw.type);
          const record = raw as Record<string, unknown>;

          let text: string | undefined;
          let mediaId: string | undefined;
          let mimeType: string | undefined;

          if (raw.type === "text") {
            const t = record.text as { body?: string } | undefined;
            text = t?.body;
          } else {
            const media = record[raw.type] as
              | { id?: string; mime_type?: string; caption?: string }
              | undefined;
            mediaId = media?.id;
            mimeType = media?.mime_type;
            text = media?.caption;
          }

          out.push({
            externalId: raw.id,
            from: raw.from,
            contactName: nameByWaId.get(raw.from),
            type: mtype,
            text,
            mediaId,
            mimeType,
            timestamp: raw.timestamp ? Number(raw.timestamp) : undefined,
            raw,
          });
        }
      }
    }
    return out;
  }
}
