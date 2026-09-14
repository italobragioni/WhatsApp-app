import { SalesStage } from "@prisma/client";

/**
 * Sales conversation state machine.
 *
 * The enum lives in Prisma (persisted on Conversation.stage). This module
 * documents each stage and the allowed transitions so the agent's stage
 * changes stay coherent and auditable.
 */
export const STAGE_DESCRIPTIONS: Record<SalesStage, string> = {
  [SalesStage.NEW_CONTACT]: "Primeiro contato do cliente.",
  [SalesStage.DISCOVERING_NEED]: "Entendendo a necessidade do cliente.",
  [SalesStage.PRESENTING_PRODUCT]: "Apresentando o produto adequado.",
  [SalesStage.ANSWERING_QUESTION]: "Respondendo dúvidas sobre o produto.",
  [SalesStage.HANDLING_OBJECTION]: "Tratando objeções do cliente.",
  [SalesStage.PURCHASE_INTENT]: "Cliente demonstrou intenção de compra.",
  [SalesStage.COLLECTING_DATA]: "Coletando dados necessários para o pedido.",
  [SalesStage.CHECKING_DELIVERY]: "Verificando disponibilidade de entrega.",
  [SalesStage.SENDING_CHECKOUT]: "Enviando link/checkout de compra.",
  [SalesStage.ORDER_PLACED]: "Pedido realizado.",
  [SalesStage.POST_SALE]: "Pós-venda e acompanhamento.",
  [SalesStage.HANDOFF_HUMAN]: "Transferido para atendimento humano.",
};

/**
 * Allowed forward transitions. HANDOFF_HUMAN is reachable from any stage and is
 * therefore added dynamically in `canTransition`.
 */
const ALLOWED_TRANSITIONS: Record<SalesStage, SalesStage[]> = {
  [SalesStage.NEW_CONTACT]: [
    SalesStage.DISCOVERING_NEED,
    SalesStage.PRESENTING_PRODUCT,
    SalesStage.ANSWERING_QUESTION,
  ],
  [SalesStage.DISCOVERING_NEED]: [
    SalesStage.PRESENTING_PRODUCT,
    SalesStage.ANSWERING_QUESTION,
  ],
  [SalesStage.PRESENTING_PRODUCT]: [
    SalesStage.ANSWERING_QUESTION,
    SalesStage.HANDLING_OBJECTION,
    SalesStage.PURCHASE_INTENT,
  ],
  [SalesStage.ANSWERING_QUESTION]: [
    SalesStage.PRESENTING_PRODUCT,
    SalesStage.HANDLING_OBJECTION,
    SalesStage.PURCHASE_INTENT,
  ],
  [SalesStage.HANDLING_OBJECTION]: [
    SalesStage.ANSWERING_QUESTION,
    SalesStage.PURCHASE_INTENT,
    SalesStage.PRESENTING_PRODUCT,
  ],
  [SalesStage.PURCHASE_INTENT]: [SalesStage.COLLECTING_DATA],
  [SalesStage.COLLECTING_DATA]: [
    SalesStage.CHECKING_DELIVERY,
    SalesStage.SENDING_CHECKOUT,
  ],
  [SalesStage.CHECKING_DELIVERY]: [
    SalesStage.SENDING_CHECKOUT,
    SalesStage.COLLECTING_DATA,
  ],
  [SalesStage.SENDING_CHECKOUT]: [SalesStage.ORDER_PLACED],
  [SalesStage.ORDER_PLACED]: [SalesStage.POST_SALE],
  [SalesStage.POST_SALE]: [],
  [SalesStage.HANDOFF_HUMAN]: [],
};

/** Whether `to` is a valid next stage from `from`. */
export function canTransition(from: SalesStage, to: SalesStage): boolean {
  if (to === SalesStage.HANDOFF_HUMAN) return true;
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}
