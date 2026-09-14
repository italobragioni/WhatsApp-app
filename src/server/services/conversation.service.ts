import {
  AgentMode,
  type Conversation,
  ConversationChannel,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";

/** Conversation lifecycle and human-in-the-loop controls. */

export type ConversationWithCustomer = Prisma.ConversationGetPayload<{
  include: { customer: true; product: true };
}>;

export type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: {
    customer: true;
    product: true;
    messages: true;
  };
}>;

export async function listConversations(): Promise<ConversationWithCustomer[]> {
  return prisma.conversation.findMany({
    include: { customer: true, product: true },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getConversation(
  id: string,
): Promise<ConversationWithCustomer | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: { customer: true, product: true },
  });
}

export async function getConversationWithMessages(
  id: string,
): Promise<ConversationWithMessages | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      product: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Create an internal TEST conversation (channel = MANUAL). Reuses/creates a
 * customer by phone so the admin can simulate a client from the panel.
 */
export async function createTestConversation(input: {
  productId?: string | null;
  customerName?: string | null;
  customerPhone: string;
}): Promise<Conversation> {
  const customer = await prisma.customer.upsert({
    where: { phone: input.customerPhone },
    create: {
      phone: input.customerPhone,
      name: input.customerName ?? null,
    },
    update: input.customerName ? { name: input.customerName } : {},
  });

  return prisma.conversation.create({
    data: {
      customerId: customer.id,
      productId: input.productId ?? null,
      channel: ConversationChannel.MANUAL,
    },
  });
}

/**
 * Find the open conversation for a customer or create one. Used when routing
 * an inbound message to the right thread (future WhatsApp flow).
 */
export async function getOrCreateOpenConversation(
  customerId: string,
  channel: ConversationChannel = ConversationChannel.WHATSAPP,
): Promise<Conversation> {
  const existing = await prisma.conversation.findFirst({
    where: { customerId, status: { in: ["OPEN", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({ data: { customerId, channel } });
}

/**
 * Change the agent posture for a conversation (human-in-the-loop).
 * When set to HUMAN, the AI agent must stop responding automatically until it
 * is reactivated (see SalesAgent.shouldAutoRespond).
 */
export async function setAgentMode(
  conversationId: string,
  mode: AgentMode,
): Promise<Conversation> {
  logger.info("conversation", "Agent mode changed", { conversationId, mode });
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { agentMode: mode },
  });
}
