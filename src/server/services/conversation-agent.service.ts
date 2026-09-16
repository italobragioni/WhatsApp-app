import {
  AgentMode,
  ConversationStatus,
  MessageSender,
  MessageType,
  type Message,
  type Prisma,
} from "@prisma/client";

import { getProductOffers, resolveOfferIndex } from "@/lib/checkout";
import { sanitizeCustomerText } from "@/server/ai/guardrails";
import { SalesAgent, salesAgent } from "@/server/ai/sales-agent";
import {
  AiUnavailableError,
  type AgentContext,
  type AgentResponse,
} from "@/server/ai/types";
import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";

import { appendMessage } from "./message.service";
import { createAssistedOrder } from "./order.service";

/**
 * Orchestrates a single customer turn inside a test conversation:
 *   persist customer message -> build context -> run AI -> persist agent
 *   message -> update stage/mode. All external-integration-free.
 */

export type TurnResult =
  | {
      status: "ok";
      customerMessage: Message;
      agentMessage: Message;
      response: AgentResponse;
    }
  | {
      status: "skipped";
      reason: "empty" | "not_active" | "not_found" | "duplicate";
      customerMessage?: Message;
    }
  | {
      status: "error";
      message: string;
      customerMessage?: Message;
    };

/**
 * Options for a single turn. `externalId`/`type`/`metadata` let non-console
 * channels (e.g. WhatsApp) reuse this exact pipeline while tagging the inbound
 * message with the provider's message id for idempotency and audit.
 */
export interface RunTurnOptions {
  agent?: SalesAgent;
  externalId?: string | null;
  type?: MessageType;
  metadata?: Prisma.InputJsonValue;
}

const FRIENDLY_AI_ERROR =
  "A IA está temporariamente indisponível. Tente novamente em instantes ou assuma o atendimento manualmente.";

export async function runCustomerTurn(
  conversationId: string,
  rawText: string,
  options: RunTurnOptions = {},
): Promise<TurnResult> {
  const agent = options.agent ?? salesAgent;
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, agentMode: true },
  });
  if (!conversation) {
    return { status: "skipped", reason: "not_found" };
  }

  // Cost control + input validation: never process empty input.
  const text = sanitizeCustomerText(rawText);
  if (!text) {
    return { status: "skipped", reason: "empty" };
  }

  // Message-level idempotency guard: if this provider message id was already
  // stored, do NOT generate another reply (belt-and-suspenders alongside the
  // IntegrationEvent-level dedup in the WhatsApp webhook service).
  if (options.externalId) {
    const existing = await prisma.message.findUnique({
      where: {
        conversationId_externalId: {
          conversationId,
          externalId: options.externalId,
        },
      },
    });
    if (existing) {
      return { status: "skipped", reason: "duplicate", customerMessage: existing };
    }
  }

  // Persist the customer message regardless of agent mode (audit + UI).
  const customerMessage = await appendMessage({
    conversationId,
    sender: MessageSender.CUSTOMER,
    type: options.type ?? MessageType.TEXT,
    content: text,
    externalId: options.externalId ?? null,
    metadata: options.metadata,
  });

  // Cost control + human-in-the-loop: do not call the model when not ACTIVE.
  if (!agent.shouldAutoRespond(conversation)) {
    return { status: "skipped", reason: "not_active", customerMessage };
  }

  try {
    const context = await agent.buildContext(conversationId, {
      type: MessageType.TEXT,
      content: text,
    });
    const response = await agent.generateResponse(context);

    const metadata: Prisma.InputJsonValue = {
      intent: response.intent,
      nextStage: response.nextStage,
      actions: response.actions,
      requiresHumanHandoff: response.requiresHumanHandoff,
      handoffReason: response.handoffReason ?? null,
      dataToCollect: response.dataToCollect,
      purchaseIntent: response.purchaseIntent,
      assistedPurchase: response.assistedPurchase ?? false,
      usedKnowledgeIds: response.usedKnowledgeIds,
      confidence: response.confidence ?? null,
    };

    // Assisted order: the customer asked the bot to place/schedule for them and
    // provided their address. Register a pending order (best-effort — never let
    // this fail the turn) so a human can complete the Logzz scheduling.
    if (response.assistedOrderReady && (response.collectedAddress ?? "").trim()) {
      await registerAssistedOrder(conversationId, context, response);
    }

    const agentMessage = await appendMessage({
      conversationId,
      sender: MessageSender.AGENT,
      type: MessageType.TEXT,
      content: response.reply,
      metadata,
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        stage: response.nextStage,
        ...(response.requiresHumanHandoff
          ? {
              agentMode: AgentMode.HUMAN,
              status: ConversationStatus.PENDING,
            }
          : {}),
      },
    });

    if (response.requiresHumanHandoff) {
      logger.info("conversation-agent", "Handoff to human", {
        conversationId,
        reason: response.handoffReason ?? undefined,
      });
    }

    return { status: "ok", customerMessage, agentMessage, response };
  } catch (error) {
    const isAiUnavailable = error instanceof AiUnavailableError;
    logger.error("conversation-agent", "Agent turn failed", {
      conversationId,
      kind: isAiUnavailable ? "ai_unavailable" : "unexpected",
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      status: "error",
      message: FRIENDLY_AI_ERROR,
      customerMessage,
    };
  }
}

/**
 * Register the assisted order from the collected address. Resolves the chosen
 * offer (for label + amount) and stores it as a pending order. Best-effort: any
 * failure is logged but never breaks the customer turn.
 */
async function registerAssistedOrder(
  conversationId: string,
  context: AgentContext,
  response: AgentResponse,
): Promise<void> {
  try {
    const offers = getProductOffers(context.product);
    const idx = resolveOfferIndex(
      offers,
      response.checkoutOptionIndex ?? null,
      context.incomingMessage.content,
    );
    const chosen = idx >= 0 ? offers[idx] : undefined;

    await createAssistedOrder({
      customerId: context.customer.id,
      productId: context.product?.id ?? null,
      conversationId,
      address: (response.collectedAddress ?? "").trim(),
      optionLabel: chosen?.label ?? null,
      amountCents: chosen?.priceCents ?? context.product?.priceCents ?? 0,
      currency: context.product?.currency ?? "BRL",
    });
    logger.info("conversation-agent", "Assisted order registered", {
      conversationId,
    });
  } catch (error) {
    logger.error("conversation-agent", "Failed to register assisted order", {
      conversationId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
