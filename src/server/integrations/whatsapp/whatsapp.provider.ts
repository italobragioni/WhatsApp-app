import { IntegrationProviderType } from "@prisma/client";

import {
  type DownloadedMedia,
  type IntegrationResult,
  type MessagingProvider,
  type NormalizedInboundMessage,
  NotImplementedError,
  type OutboundMediaMessage,
  type OutboundTextMessage,
} from "../types";

/**
 * WhatsApp provider (WhatsApp Business / Cloud API).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NOT CONNECTED YET. This is a contract implementation only.           │
 * │  No tokens, no HTTP calls, no real endpoints. Methods throw           │
 * │  NotImplementedError until we wire the real API in a later step.      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Planned inbound flow (future):
 *   webhook -> verifyWebhookSignature -> parseInboundWebhook ->
 *   IntegrationEvent (dedupe) -> Conversation/Message -> AI Sales Agent.
 */
export class WhatsAppProvider implements MessagingProvider {
  readonly type = IntegrationProviderType.WHATSAPP;
  readonly name = "WhatsApp Cloud API";

  isConfigured(): boolean {
    // Real check will look for WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID etc.
    return false;
  }

  async sendText(
    _message: OutboundTextMessage,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    throw new NotImplementedError(this.name, "sendText");
  }

  async sendMedia(
    _message: OutboundMediaMessage,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    throw new NotImplementedError(this.name, "sendMedia");
  }

  async downloadMedia(
    _mediaId: string,
  ): Promise<IntegrationResult<DownloadedMedia>> {
    throw new NotImplementedError(this.name, "downloadMedia");
  }

  verifyWebhookSignature(_input: {
    payload: string;
    signature: string | null;
  }): boolean {
    throw new NotImplementedError(this.name, "verifyWebhookSignature");
  }

  parseInboundWebhook(_payload: unknown): NormalizedInboundMessage[] {
    throw new NotImplementedError(this.name, "parseInboundWebhook");
  }
}
