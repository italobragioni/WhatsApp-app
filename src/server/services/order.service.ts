import { type Order, OrderStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/** Order business logic. External fulfillment (Logzz) is wired later. */

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { customer: true; product: true };
}>;

export async function listOrders(): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    include: { customer: true, product: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { id },
    include: { customer: true, product: true },
  });
}

/** Orders for a customer (used to show order status inside a conversation). */
export async function listOrdersByCustomer(
  customerId: string,
): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: { customerId },
    include: { customer: true, product: true },
    orderBy: { updatedAt: "desc" },
  });
}

export interface CreateDraftOrderInput {
  customerId: string;
  productId?: string;
  conversationId?: string;
  amountCents?: number;
  currency?: string;
}

/** Create a local draft order. It is only sent to Logzz once that integration
 *  exists and the required data is confirmed. */
export async function createDraftOrder(
  input: CreateDraftOrderInput,
): Promise<Order> {
  return prisma.order.create({
    data: {
      customerId: input.customerId,
      productId: input.productId,
      conversationId: input.conversationId,
      amountCents: input.amountCents ?? 0,
      currency: input.currency ?? "BRL",
      status: OrderStatus.DRAFT,
    },
  });
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return prisma.order.update({ where: { id }, data: { status } });
}

export interface CreateAssistedOrderInput {
  customerId: string;
  productId?: string | null;
  conversationId: string;
  address: string;
  optionLabel?: string | null;
  amountCents?: number;
  currency?: string;
}

/**
 * Register an ASSISTED order: the customer asked the bot to place/schedule the
 * order for them (they won't use the link). We capture the delivery address and
 * mark it for a human to complete the Logzz scheduling. It is idempotent per
 * conversation — a second "ready" turn won't create a duplicate.
 */
export async function createAssistedOrder(
  input: CreateAssistedOrderInput,
): Promise<Order | null> {
  const existing = await prisma.order.findFirst({
    where: {
      conversationId: input.conversationId,
      metadata: { path: ["source"], equals: "assistido" },
    },
  });
  if (existing) return existing;

  return prisma.order.create({
    data: {
      customerId: input.customerId,
      productId: input.productId ?? undefined,
      conversationId: input.conversationId,
      amountCents: input.amountCents ?? 0,
      currency: input.currency ?? "BRL",
      // Local draft: registered by the agent, pending a human to schedule in Logzz.
      status: OrderStatus.DRAFT,
      deliveryData: { address: input.address },
      metadata: {
        source: "assistido",
        situacao: "aguardando_agendamento",
        optionLabel: input.optionLabel ?? null,
      },
    },
  });
}
