import { KnowledgeCategory, type ProductKnowledge } from "@prisma/client";
import { z } from "zod";

import { LONG_TEXT_MAX } from "@/lib/limits";
import { prisma } from "@/server/db/prisma";

/** Curated product knowledge — the grounding source for the AI agent. */

export const knowledgeInputSchema = z.object({
  productId: z.string().min(1),
  category: z.nativeEnum(KnowledgeCategory).default(KnowledgeCategory.GENERAL),
  // `question` is a short label; `answer`/`content` are long AI-facing text.
  question: z.string().max(1000).optional().nullable(),
  answer: z.string().max(LONG_TEXT_MAX).optional().nullable(),
  content: z.string().min(1).max(LONG_TEXT_MAX),
  priority: z.number().int().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

export type KnowledgeInput = z.input<typeof knowledgeInputSchema>;

export async function listKnowledge(
  productId: string,
): Promise<ProductKnowledge[]> {
  return prisma.productKnowledge.findMany({
    where: { productId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function createKnowledge(
  input: KnowledgeInput,
): Promise<ProductKnowledge> {
  const data = knowledgeInputSchema.parse(input);
  return prisma.productKnowledge.create({ data });
}

export async function deleteKnowledge(id: string): Promise<void> {
  await prisma.productKnowledge.delete({ where: { id } });
}

/**
 * Build the ordered knowledge set the agent may use for a product. Only active
 * items, highest priority first, capped to keep the agent context bounded.
 */
export async function getGroundingKnowledge(
  productId: string,
  limit = 50,
): Promise<ProductKnowledge[]> {
  return prisma.productKnowledge.findMany({
    where: { productId, active: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}
