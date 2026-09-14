import {
  AgentMode,
  ConversationChannel,
  IntegrationProviderType,
  MessageSender,
  MessageType,
  type Prisma,
} from "@prisma/client";

import { integrations } from "@/server/integrations";
import type {
  MessagingProvider,
  NormalizedInboundMessage,
} from "@/server/integrations/types";
import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";

import { getOrCreateOpenConversation } from "./conversation.service";
import { runCustomerTurn, type TurnResult } from "./conversation-agent.service";
import { upsertCustomerByPhone } from "./customer.service";
import { appendMessage } from "./message.service";
import { transcribeInboundAudio } from "./whatsapp-audio.service";

/**
 * WhatsApp webhook processing service.
 *
 * Architecture:  Webhook route → this service → ConversationService /
 * runCustomerTurn (SalesAgent) → MessagingProvider (WhatsAppProvider) → Meta.
 *
 * The route and the internal test tool both call the SAME entry points here, so
 * there is a single source of truth for inbound handling.
 *
 * IDEMPOTENCY: every inbound message is keyed by Meta's message id (wamid) in
 * `IntegrationEvent(provider, externalId)` (unique). A message already marked
 * processed is skipped, so webhook redeliveries never trigger a second AI reply.
 *
 * ASYNC/QUEUE NOTE: processing is synchronous today (safe and simple for low
 * volume). This function is the exact seam where a queue (e.g. QStash / a DB
 * worker) would be introduced: enqueue after the IntegrationEvent is recorded
 * and move the agent+send steps to the worker. The route already returns 200
 * quickly regardless.
 */

export interface WhatsAppDeps {
  provider?: MessagingProvider;
  runTurn?: typeof runCustomerTurn;
  /** Injectable audio→text step (download + transcription). */
  transcribeAudio?: typeof transcribeInboundAudio;
}

export type IncomingResult =
  | { status: "duplicate" }
  | { status: "unsupported"; conversationId: string }
  | { status: "audio_failed"; conversationId: string }
  | { status: "ok" | "skipped" | "error"; conversationId?: string };

const UNSUPPORTED_REPLY =
  "No momento consigo entender apenas mensagens de texto. Pode me escrever sua dúvida por texto? 🙂";

/** Friendly, non-technical replies for each audio failure mode. */
const AUDIO_REPLY = {
  empty:
    "Não consegui entender o áudio. Pode me mandar novamente ou escrever a mensagem por texto?",
  transcription_error:
    "Não consegui ouvir esse áudio. Pode tentar enviar novamente ou mandar a mensagem por texto?",
  download_error:
    "Não consegui receber esse áudio. Pode tentar enviar novamente ou mandar a mensagem por texto?",
  too_large:
    "Esse áudio é muito grande para eu processar. Pode enviar um áudio mais curto ou escrever por texto?",
  unsupported_format:
    "Não consegui processar o formato desse áudio. Pode escrever a mensagem por texto?",
  not_configured:
    "No momento não consigo ouvir áudios. Pode escrever a sua mensagem por texto?",
} as const;

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

async function markProcessed(eventId: string): Promise<void> {
  await prisma.integrationEvent.update({
    where: { id: eventId },
    data: { processed: true, processedAt: new Date() },
  });
}

/**
 * Deliver the agent's reply over WhatsApp and record the delivery outcome on
 * the stored agent message. Only "ok" turns produce a reply. Shared by the
 * text and audio flows so the send logic is never duplicated.
 */
async function deliverReply(
  result: TurnResult,
  to: string,
  provider: MessagingProvider,
  conversationId: string,
): Promise<void> {
  if (result.status !== "ok") return;
  const send = await provider.sendText({ to, text: result.response.reply });
  if (send.ok) {
    await prisma.message.update({
      where: { id: result.agentMessage.id },
      data: {
        metadata: mergeMetadata(result.agentMessage.metadata, {
          providerMessageId: send.data.externalId,
          delivery: "sent",
        }),
      },
    });
  } else {
    logger.error("whatsapp.webhook", "Failed to deliver AI reply", {
      code: send.code,
      detail: send.error,
      conversationId,
    });
    await prisma.message.update({
      where: { id: result.agentMessage.id },
      data: {
        metadata: mergeMetadata(result.agentMessage.metadata, {
          delivery: "error",
        }),
      },
    });
  }
}

/** Send a canned auto-reply (unsupported type / audio failure) if ACTIVE. */
async function sendAutoReply(
  conversationId: string,
  to: string,
  text: string,
  provider: MessagingProvider,
  reason: string,
): Promise<void> {
  const send = await provider.sendText({ to, text });
  await appendMessage({
    conversationId,
    sender: MessageSender.AGENT,
    type: MessageType.TEXT,
    content: text,
    metadata: {
      auto: reason,
      delivery: send.ok ? "sent" : "error",
      providerMessageId: send.ok ? send.data.externalId : null,
    },
  });
}

/**
 * Process one normalized inbound WhatsApp message through the full pipeline.
 * Idempotent by `message.externalId`.
 */
export async function processIncomingWhatsAppMessage(
  message: NormalizedInboundMessage,
  deps: WhatsAppDeps = {},
): Promise<IncomingResult> {
  const provider = deps.provider ?? integrations.messaging();
  const runTurn = deps.runTurn ?? runCustomerTurn;
  const transcribeAudio = deps.transcribeAudio ?? transcribeInboundAudio;

  // 1. Event-level idempotency.
  const existing = await prisma.integrationEvent.findUnique({
    where: {
      provider_externalId: {
        provider: IntegrationProviderType.WHATSAPP,
        externalId: message.externalId,
      },
    },
  });
  if (existing?.processed) {
    return { status: "duplicate" };
  }

  let eventId = existing?.id;
  if (!existing) {
    try {
      const created = await prisma.integrationEvent.create({
        data: {
          provider: IntegrationProviderType.WHATSAPP,
          eventType: "message",
          externalId: message.externalId,
          direction: "inbound",
          payload: (message.raw ?? {}) as Prisma.InputJsonValue,
          processed: false,
        },
      });
      eventId = created.id;
    } catch {
      // Unique violation => a concurrent delivery is already handling it.
      logger.warn("whatsapp.webhook", "Duplicate event (race); skipping", {
        externalId: message.externalId,
      });
      return { status: "duplicate" };
    }
  }

  try {
    // 2. Customer (never one per message; reuse by phone).
    const customer = await upsertCustomerByPhone(
      message.from,
      message.contactName ? { name: message.contactName } : undefined,
    );

    // 3. Conversation (WhatsApp channel; reuse an open one).
    const conversation = await getOrCreateOpenConversation(
      customer.id,
      ConversationChannel.WHATSAPP,
    );

    // 4. AUDIO: transcribe, then feed the text into the SAME agent pipeline.
    //    The SalesAgent never knows the customer spoke instead of typing.
    if (message.type === MessageType.AUDIO) {
      const audio = await transcribeAudio(message, { provider });

      if (audio.status === "ok") {
        const result = await runTurn(conversation.id, audio.text, {
          externalId: message.externalId,
          type: MessageType.AUDIO,
          metadata: {
            channel: "whatsapp",
            originalType: "audio",
            mediaId: audio.meta.mediaId,
            mimeType: audio.meta.mimeType,
            waTimestamp: audio.meta.waTimestamp,
            audioProcessingMs: audio.meta.totalMs ?? null,
            transcription: {
              text: audio.text,
              model: audio.model,
              status: "completed",
            },
          },
        });
        await deliverReply(result, message.from, provider, conversation.id);
        if (eventId) await markProcessed(eventId);
        return { status: result.status, conversationId: conversation.id };
      }

      // Transcription produced no usable text: store the AUDIO message with a
      // failed transcription status, reply politely, and never call the agent.
      await appendMessage({
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        type: MessageType.AUDIO,
        content: "[áudio]",
        externalId: message.externalId,
        metadata: {
          channel: "whatsapp",
          originalType: "audio",
          mediaId: audio.meta.mediaId,
          mimeType: audio.meta.mimeType,
          waTimestamp: audio.meta.waTimestamp,
          transcription: { status: "failed", reason: audio.status },
        },
      });
      if (conversation.agentMode === AgentMode.ACTIVE) {
        await sendAutoReply(
          conversation.id,
          message.from,
          AUDIO_REPLY[audio.status],
          provider,
          `audio_${audio.status}`,
        );
      }
      if (eventId) await markProcessed(eventId);
      return { status: "audio_failed", conversationId: conversation.id };
    }

    // 5. Other non-text types: record, log, optionally reply, no AI.
    if (message.type !== MessageType.TEXT) {
      await appendMessage({
        conversationId: conversation.id,
        sender: MessageSender.CUSTOMER,
        type: message.type,
        content: message.text ?? `[${message.type.toLowerCase()}]`,
        externalId: message.externalId,
        metadata: {
          channel: "whatsapp",
          mediaId: message.mediaId ?? null,
          mimeType: message.mimeType ?? null,
          waTimestamp: message.timestamp ?? null,
          unsupported: true,
        },
      });
      logger.info("whatsapp.webhook", "Unsupported message type received", {
        type: message.type,
        conversationId: conversation.id,
      });

      if (conversation.agentMode === AgentMode.ACTIVE) {
        await sendAutoReply(
          conversation.id,
          message.from,
          UNSUPPORTED_REPLY,
          provider,
          "unsupported_type",
        );
      }

      if (eventId) await markProcessed(eventId);
      return { status: "unsupported", conversationId: conversation.id };
    }

    // 6. TEXT: reuse the exact same agent pipeline as the console.
    const result = await runTurn(conversation.id, message.text ?? "", {
      externalId: message.externalId,
      type: MessageType.TEXT,
      metadata: {
        channel: "whatsapp",
        waTimestamp: message.timestamp ?? null,
      },
    });
    await deliverReply(result, message.from, provider, conversation.id);
    if (eventId) await markProcessed(eventId);
    return { status: result.status, conversationId: conversation.id };
  } catch (err) {
    // Leave the event unprocessed so a redelivery can retry; store the reason.
    logger.error("whatsapp.webhook", "Processing failed", {
      externalId: message.externalId,
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
    return { status: "error" };
  }
}

/**
 * Parse a raw webhook payload and process every inbound message it contains.
 * Used by the webhook route. Returns counts for logging/observability.
 */
export async function handleWhatsAppWebhookPayload(
  payload: unknown,
  deps: WhatsAppDeps = {},
): Promise<{ received: number }> {
  const provider = deps.provider ?? integrations.messaging();
  const messages = provider.parseInboundWebhook(payload);
  for (const message of messages) {
    await processIncomingWhatsAppMessage(message, deps);
  }
  return { received: messages.length };
}
