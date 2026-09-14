"use server";

import { KnowledgeCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createKnowledge,
  deleteKnowledge,
} from "@/server/services/knowledge.service";

const createSchema = z.object({
  productId: z.string().min(1),
  category: z.nativeEnum(KnowledgeCategory).default(KnowledgeCategory.FAQ),
  question: z.string().max(1000).optional(),
  answer: z.string().max(5000).optional(),
  content: z.string().max(8000).optional(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
});

export type KnowledgeFormState = { error: string } | undefined;

export async function createKnowledgeAction(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const parsed = createSchema.safeParse({
    productId: formData.get("productId"),
    category: formData.get("category") || undefined,
    question: formData.get("question") || undefined,
    answer: formData.get("answer") || undefined,
    content: formData.get("content") || undefined,
    priority: formData.get("priority") || 0,
  });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  // `content` is the source-of-truth text. Derive it from Q/A when omitted.
  const content =
    parsed.data.content?.trim() ||
    [parsed.data.question, parsed.data.answer].filter(Boolean).join(" — ");
  if (!content) {
    return { error: "Informe ao menos a resposta ou o conteúdo." };
  }

  try {
    await createKnowledge({
      productId: parsed.data.productId,
      category: parsed.data.category,
      question: parsed.data.question ?? null,
      answer: parsed.data.answer ?? null,
      content,
      priority: parsed.data.priority,
    });
  } catch {
    return { error: "Não foi possível salvar o item." };
  }

  revalidatePath(`/knowledge/${parsed.data.productId}`);
  return undefined;
}

export async function deleteKnowledgeAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!id) return;
  await deleteKnowledge(id);
  if (productId) revalidatePath(`/knowledge/${productId}`);
}
