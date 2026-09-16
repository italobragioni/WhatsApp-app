import { SalesStage } from "@prisma/client";
import { z } from "zod";

import { getProductOffers, resolveOfferIndex } from "@/lib/checkout";

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
  // Which checkout offer the customer wants (0-based index), when the product
  // lists multiple options. null = not yet decided (ask the customer).
  checkout_option: z.number().int().min(0).nullable().default(null),
  // Assisted order: the customer wants the bot to place/schedule the order for
  // them (won't use the link / doesn't know how). Collect the address instead.
  assisted_purchase: z.boolean().default(false),
  assisted_order_ready: z.boolean().default(false),
  collected_address: z.string().max(2000).nullable().default(null),
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
  "checkout_option": number|null,        // índice (0,1,...) da opção de checkout escolhida; null se ainda não decidido
  "assisted_purchase": boolean,          // true se o cliente quer que VOCÊ faça/agende o pedido por ele
  "assisted_order_ready": boolean,       // true quando já tem o endereço completo para registrar o pedido
  "collected_address": string|null,      // endereço completo informado pelo cliente (rua, número, bairro, cidade/UF, CEP)
  "used_knowledge_ids": string[],        // ids dos itens de conhecimento usados
  "confidence": number                   // 0..1 (opcional)
}
NUNCA escreva URLs, links ou markdown de link (como [texto](#)) no campo "reply", e NUNCA diga que "não consegue enviar o link", que o cliente deve "procurar/buscar o produto no site" ou "acessar o site" — isso está ERRADO e não existe. Você não escreve o link, mas o SISTEMA anexa automaticamente o link OFICIAL de checkout do produto ao final da sua resposta.
Quando o cliente demonstrar intenção de compra OU pedir o link, perguntar onde/como comprar ou como pagar: defina "wants_checkout": true e "intent": "PURCHASE_INTENT", e escreva uma confirmação curta e calorosa como "Perfeito! Aqui está o link para você finalizar sua compra:" (sem escrever o link — o sistema o adiciona).
OPÇÕES DE CHECKOUT: se o produto listar MAIS DE UMA opção (ex.: [0] 1 unidade, [1] 2 unidades), identifique qual o cliente quer e coloque o índice em "checkout_option". Se ainda não estiver claro qual opção, NÃO escolha: mantenha "checkout_option": null, apresente as opções com seus preços e pergunte qual ele prefere. Havendo apenas uma opção, use "checkout_option": 0.
PEDIDO ASSISTIDO / AGENDAMENTO: se o cliente NÃO quiser comprar pelo link, não souber comprar, ou pedir para VOCÊ fazer/agendar o pedido por ele (ex.: "você faz pra mim?", "não sei comprar", "não consigo pelo link"), NUNCA recuse. Diga com naturalidade que você mesmo registra o pedido e agenda a entrega para ele, e defina "assisted_purchase": true. Peça o que faltar em "data_to_collect": nome completo, endereço completo (rua, número, bairro, cidade/UF) e CEP (e confirme a opção, se houver mais de uma). Quando o cliente já tiver informado o endereço completo, defina "assisted_order_ready": true e coloque o endereço em "collected_address", confirmando que o pedido foi registrado e que a equipe fará o agendamento da entrega — NUNCA invente data ou horário de entrega.`;

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
  // and the product actually has at least one real, cadastrado offer.
  const offers = getProductOffers(context.product);
  const checkoutAllowed =
    context.availableActions.includes("SEND_CHECKOUT") && offers.length > 0;
  if (!handoff && raw.wants_checkout && checkoutAllowed) {
    // Pick the offer the customer wants and carry its REAL cadastrado URL —
    // never a model-generated one. (The guardrail is the final source of truth.)
    const idx = resolveOfferIndex(
      offers,
      raw.checkout_option,
      context.incomingMessage.content,
    );
    if (idx >= 0) {
      actions.push({ type: "SEND_CHECKOUT", url: offers[idx]!.url });
    }
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
    checkoutOptionIndex: raw.checkout_option,
    assistedPurchase: raw.assisted_purchase,
    assistedOrderReady: raw.assisted_order_ready,
    collectedAddress: raw.collected_address,
    usedKnowledgeIds: raw.used_knowledge_ids,
    confidence: raw.confidence,
  };
}
