import { SalesStage, type Product } from "@prisma/client";

import type { AgentContext } from "@/server/ai/types";

export function makeProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date();
  return {
    id: "prod_1",
    ownerId: null,
    name: "Produto Teste",
    slug: "produto-teste",
    description: "Descrição do produto",
    priceCents: 4990,
    currency: "BRL",
    benefits: ["Benefício A"],
    features: ["Característica A"],
    salesArguments: ["Melhor custo-benefício"],
    warranty: "30 dias",
    deliveryInfo: null,
    paymentInfo: "Pagamento na entrega",
    aiAllowedTopics: [],
    aiForbiddenTopics: [],
    checkoutUrl: null,
    externalId: null,
    offerId: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  const product = overrides.product ?? makeProduct();
  return {
    conversationId: "conv_1",
    stage: SalesStage.NEW_CONTACT,
    summary: null,
    customer: {
      id: "cust_1",
      name: "João",
      phone: "+5511999999999",
      email: null,
      city: null,
      state: null,
      postalCode: null,
    },
    product,
    knowledge: [],
    settings: null,
    history: [],
    incomingMessage: { type: "TEXT", content: "Oi" },
    availableActions: product?.checkoutUrl
      ? ["SEND_TEXT", "REQUEST_CUSTOMER_DATA", "CHECK_DELIVERY", "HANDOFF_HUMAN", "SEND_CHECKOUT"]
      : ["SEND_TEXT", "REQUEST_CUSTOMER_DATA", "CHECK_DELIVERY", "HANDOFF_HUMAN"],
    ...overrides,
  };
}
