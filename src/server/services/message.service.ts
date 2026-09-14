import {
  type Message,
  MessageSender,
  MessageType,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/** Message persistence with inbound de-duplication. */

export interface AppendMessageInput {
  conversationId: string;
  sender: MessageSender;
  type?: MessageType;
  content: string;
  mediaUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Provider-side id used to deduplicate inbound webhook deliveries. */
  externalId?: string | null;
}

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<Message[]> {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Append a message to a conversation and bump `lastMessageAt`. If `externalId`
 * is provided and already exists for the conversation, the existing message is
 * returned instead of creating a duplicate (idempotent inbound handling).
 */
export async function appendMessage(
  input: AppendMessageInput,
): Promise<Message> {
  if (input.externalId) {
    const existing = await prisma.message.findUnique({
      where: {
        conversationId_externalId: {
          conversationId: input.conversationId,
          externalId: input.externalId,
        },
      },
    });
    if (existing) return existing;
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: input.conversationId,
        sender: input.sender,
        type: input.type ?? MessageType.TEXT,
        content: input.content,
        mediaUrl: input.mediaUrl ?? null,
        metadata: input.metadata,
        externalId: input.externalId ?? null,
      },
    }),
    prisma.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return message;
}
