"use server";

import { MessageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { NormalizedInboundMessage } from "@/server/integrations/types";
import { processIncomingWhatsAppMessage } from "@/server/services/whatsapp-webhook.service";

const schema = z.object({
  phone: z.string().min(3).max(30),
  name: z.string().max(160).optional(),
  text: z.string().min(1).max(2000),
});

/**
 * Internal test tool: simulate an inbound WhatsApp text message through the
 * EXACT same pipeline the webhook uses (processIncomingWhatsAppMessage). Lets
 * the admin exercise the flow without putting real customers into production.
 *
 * The synthetic message id is unique per call, so it is never deduplicated.
 * Sending the reply requires WhatsApp to be configured; if it isn't, the agent
 * still runs and the reply is stored (delivery marked as error), which is fine
 * for internal testing.
 */
export async function simulateInboundWhatsAppAction(
  formData: FormData,
): Promise<void> {
  const parsed = schema.safeParse({
    phone: formData.get("phone") || undefined,
    name: formData.get("name") || undefined,
    text: formData.get("text") || undefined,
  });
  if (!parsed.success) {
    redirect("/integrations?error=1");
  }

  const message: NormalizedInboundMessage = {
    externalId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: parsed.data.phone,
    contactName: parsed.data.name,
    type: MessageType.TEXT,
    text: parsed.data.text,
    raw: { simulated: true },
  };

  const result = await processIncomingWhatsAppMessage(message);
  revalidatePath("/conversations");

  if ("conversationId" in result && result.conversationId) {
    redirect(`/conversations/${result.conversationId}`);
  }
  redirect("/conversations");
}
