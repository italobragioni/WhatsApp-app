"use server";

import { AgentMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createTestConversation,
  setAgentMode,
} from "@/server/services/conversation.service";
import { runCustomerTurn } from "@/server/services/conversation-agent.service";

const newConversationSchema = z.object({
  productId: z.string().optional(),
  customerName: z.string().max(160).optional(),
  customerPhone: z.string().min(3).max(30),
});

export async function createTestConversationAction(
  formData: FormData,
): Promise<void> {
  const parsed = newConversationSchema.safeParse({
    productId: formData.get("productId") || undefined,
    customerName: formData.get("customerName") || undefined,
    customerPhone: formData.get("customerPhone") || undefined,
  });
  if (!parsed.success) {
    redirect("/conversations/new?error=1");
  }

  const conversation = await createTestConversation({
    productId: parsed.data.productId || null,
    customerName: parsed.data.customerName || null,
    customerPhone: parsed.data.customerPhone,
  });

  redirect(`/conversations/${conversation.id}`);
}

export type SendState = {
  status: "idle" | "ok" | "skipped" | "error";
  message?: string;
} | undefined;

export async function sendMessageAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const text = String(formData.get("text") ?? "");
  if (!conversationId) {
    return { status: "error", message: "Conversa inválida." };
  }

  const result = await runCustomerTurn(conversationId, text);
  revalidatePath(`/conversations/${conversationId}`);

  switch (result.status) {
    case "ok":
      return { status: "ok" };
    case "skipped": {
      const messages: Record<typeof result.reason, string> = {
        not_active:
          "IA não está ativa nesta conversa (pausada ou em atendimento humano).",
        empty: "Mensagem vazia.",
        duplicate: "Mensagem duplicada (ignorada).",
        not_found: "Conversa não encontrada.",
      };
      return { status: "skipped", message: messages[result.reason] };
    }
    case "error":
      return { status: "error", message: result.message };
  }
}

const modeSchema = z.object({
  conversationId: z.string().min(1),
  mode: z.nativeEnum(AgentMode),
});

export async function setModeAction(formData: FormData): Promise<void> {
  const parsed = modeSchema.safeParse({
    conversationId: formData.get("conversationId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return;

  await setAgentMode(parsed.data.conversationId, parsed.data.mode);
  revalidatePath(`/conversations/${parsed.data.conversationId}`);
}
