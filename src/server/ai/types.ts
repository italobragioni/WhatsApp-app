import type {
  AgentSettings,
  Customer,
  MessageSender,
  MessageType,
  Product,
  ProductKnowledge,
  SalesStage,
} from "@prisma/client";

import type { NotImplementedError } from "@/server/integrations/types";

/**
 * AI Sales Agent contracts.
 * -----------------------------------------------------------------------------
 * Defines the shape of the input the agent receives and the structured output
 * it produces. The actual text generation depends on an external AI provider,
 * which is NOT connected yet (see `AiProvider` and `SalesAgent`).
 */

/** A single turn in the conversation history passed to the agent. */
export interface ConversationTurn {
  sender: MessageSender;
  type: MessageType;
  content: string;
}

/**
 * Everything the agent is allowed to reason over. This is the ONLY knowledge
 * the agent may use. It must never invent facts outside of this context
 * (prices, delivery dates, stock, warranty, discounts, etc.).
 */
export interface AgentContext {
  conversationId: string;
  stage: SalesStage;
  customer: Pick<
    Customer,
    "id" | "name" | "phone" | "city" | "state" | "postalCode"
  >;
  product: Product | null;
  knowledge: ProductKnowledge[];
  settings: AgentSettings | null;
  history: ConversationTurn[];
  /** The new inbound customer message to respond to. */
  incomingMessage: {
    type: MessageType;
    content: string;
  };
  /**
   * Verified data returned by integrations (e.g. Logzz delivery availability).
   * When absent, the agent must not make claims that depend on it.
   */
  integrationFacts?: {
    delivery?: unknown;
  };
}

/** Discrete actions the agent may request the orchestration layer to perform. */
export type AgentAction =
  | { type: "SEND_TEXT"; text: string }
  | { type: "REQUEST_CUSTOMER_DATA"; fields: string[] }
  | { type: "CHECK_DELIVERY" }
  | { type: "SEND_CHECKOUT" }
  | { type: "CREATE_ORDER" }
  | { type: "HANDOFF_HUMAN"; reason: string };

/** Structured result produced by the agent for a single inbound message. */
export interface AgentResponse {
  /** The primary reply text to send back to the customer. */
  reply: string;
  /** The stage the conversation should move to (validated by the state machine). */
  nextStage: SalesStage;
  /** Ordered actions the orchestration layer should execute. */
  actions: AgentAction[];
  /** True when the conversation must be handed to a human. */
  requiresHumanHandoff: boolean;
  /** IDs of knowledge items the answer was grounded on (auditability). */
  usedKnowledgeIds: string[];
  /** Model confidence 0..1, when the provider supplies it. */
  confidence?: number;
}

/**
 * Abstraction over the text-generation provider (OpenAI, Anthropic, etc.).
 * NOT implemented yet. A concrete implementation will build the prompt from
 * `AgentContext`, call the model, and parse a structured `AgentResponse`.
 */
export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** @throws {NotImplementedError} until a real provider is connected. */
  generate(context: AgentContext): Promise<AgentResponse>;
}

export type { NotImplementedError };
