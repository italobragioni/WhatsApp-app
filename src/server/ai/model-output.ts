import { SalesStage } from "@prisma/client";
import { z } from "zod";

import type { AgentAction, AgentContext, AgentResponse } from "./types";

/**
 * Schema for the RAW JSON the model must return. We never trust free-form text:
 * the model's output is validated against this schema, and the concrete
 * `AgentAction[]` is then derived deterministically by our own code (below),
 * so the model cannot, for example, fabricate a checkout link.
 */
export const modelOutputSchema = z.object({
  reply: z.string().min(1),
  intent: z
    .enum([
      "GREETING",
      "QUESTION",
      "INFO_REQUEST",
      "INTEREST",
      "OBJECTION",
      "PURCHASE_INTENT",
      "HUMAN_REQUEST",
      "CANCELLATION",
      "COMPLAINT",
      "OTHER",
    ])
    .default("OTHER"),
  next_stage: z.nativeEnum(SalesStage).default(SalesStage.NEW_CONTACT),
  requires_human_handoff: z.boolean().default(false),
  handoff_reason: z.string().nullable().default(null),
  data_to_collect: z.array(z.string().min(1)).default([]),
  purchase_intent: z.boolean().default(false),
  wants_checkout: z.boolean().default(false),
  used_knowledge_ids: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** A compact description of the JSON contract, injected into the prompt. */
export const MODEL_OUTPUT_INSTRUCTIONS = `Responda SEMPRE com um único objeto JSON válido, sem texto fora do JSON, com exatamente estes campos:
{
  "reply": string,                       // sua resposta ao cliente, em português
  "intent": "GREETING"|"QUESTION"|"INFO_REQUEST"|"INTEREST"|"OBJECTION"|"PURCHASE_INTENT"|"HUMAN_REQUEST"|"CANCELLATION"|"COMPLAINT"|"OTHER",
  "next_stage": "NEW_CONTACT"|"DISCOVERING_NEED"|"PRESENTING_PRODUCT"|"ANSWERING_QUESTION"|"HANDLING_OBJECTION"|"PURCHASE_INTENT"|"COLLECTING_DATA"|"CHECKING_DELIVERY"|"SENDING_CHECKOUT"|"ORDER_PLACED"|"POST_SALE"|"HANDOFF_HUMAN",
  "requires_human_handoff": boolean,
  "handoff_reason": string|null,
  "data_to_collect": string[],           // dados do cliente ainda necessários (ex.: "nome","cep","endereço")
  "purchase_intent": boolean,
  "wants_checkout": boolean,             // true apenas se o cliente quer comprar agora
  "used_knowledge_ids": string[],        // ids dos itens de conhecimento usados
  "confidence": number                   // 0..1 (opcional)
}
NUNCA escreva URLs, links ou markdown de link (como [texto](#)) no campo "reply", e NUNCA diga que "não consegue enviar o link", que o cliente deve "procurar/buscar o produto no site" ou "acessar o site" — isso está ERRADO e não existe. Você não escreve o link, mas o SISTEMA anexa automaticamente o link OFICIAL de checkout do produto ao final da sua resposta.
Quando o cliente demonstrar intenção de compra OU pedir o link, perguntar onde/como comprar ou como pagar: defina "wants_checkout": true e "intent": "PURCHASE_INTENT", e escreva uma confirmação curta e calorosa como "Perfeito! Aqui está o link para você finalizar sua compra:" (sem escrever o link — o sistema o adiciona).`;

/**
 * Map a validated model output + context into the structured AgentResponse,
 * building the concrete action list deterministically.
 */
export function mapModelOutput(
  raw: ModelOutput,
  context: AgentContext,
): AgentResponse {
  const actions: AgentAction[] = [{ type: "SEND_TEXT", text: raw.reply }];

  const handoff = raw.requires_human_handoff;

  if (!handoff && raw.data_to_collect.length > 0) {
    actions.push({ type: "REQUEST_CUSTOMER_DATA", fields: raw.data_to_collect });
  }

  // Checkout is only offered when: the model asked for it, the flow allows it,
  // and the product actually has a real, cadastrado checkout URL.
  const checkoutAllowed =
    context.availableActions.includes("SEND_CHECKOUT") &&
    Boolean(context.product?.checkoutUrl);
  if (!handoff && raw.wants_checkout && checkoutAllowed) {
    // Carry the REAL cadastrado URL — never a model-generated one.
    actions.push({ type: "SEND_CHECKOUT", url: context.product!.checkoutUrl! });
  }

  if (handoff) {
    actions.push({
      type: "HANDOFF_HUMAN",
      reason: raw.handoff_reason ?? "Solicitado transferência para humano.",
    });
  }

  return {
    reply: raw.reply,
    intent: raw.intent,
    nextStage: handoff ? SalesStage.HANDOFF_HUMAN : raw.next_stage,
    actions,
    requiresHumanHandoff: handoff,
    handoffReason: raw.handoff_reason ?? undefined,
    dataToCollect: raw.data_to_collect,
    purchaseIntent: raw.purchase_intent,
    wantsCheckout: raw.wants_checkout,
    usedKnowledgeIds: raw.used_knowledge_ids,
    confidence: raw.confidence,
  };
}
