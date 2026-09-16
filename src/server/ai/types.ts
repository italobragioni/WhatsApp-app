import type {
  AgentSettings,
  Customer,
  MessageSender,
  MessageType,
  Product,
  ProductKnowledge,
  SalesStage,
} from "@prisma/client";

/**
 * AI Sales Agent contracts.
 * -----------------------------------------------------------------------------
 * Defines the shape of the input the agent receives and the structured output
 * it produces. Text generation is delegated to a swappable `AiProvider`
 * (see ./provider.ts). No external messaging/fulfillment integrations here.
 */

/** Intents the agent must be able to recognize from the customer's message. */
export type CustomerIntent =
  | "GREETING"
  | "QUESTION"
  | "INFO_REQUEST"
  | "INTEREST"
  | "OBJECTION"
  | "PURCHASE_INTENT"
  | "HUMAN_REQUEST"
  | "CANCELLATION"
  | "COMPLAINT"
  | "OTHER";

/**
 * Verified delivery information the agent is allowed to state. Only a
 * "confirmed" status (set from real system data) permits claiming a date/period.
 */
export type DeliveryContext =
  | { status: "confirmed"; date?: string; period?: string }
  | { status: "unknown" };

/** A single turn in the conversation history passed to the agent. */
export interface ConversationTurn {
  sender: MessageSender;
  type: MessageType;
  content: string;
}

/** Named actions the orchestration layer knows how to (eventually) execute. */
export type AgentActionType =
  | "SEND_TEXT"
  | "REQUEST_CUSTOMER_DATA"
  | "CHECK_DELIVERY"
  | "SEND_CHECKOUT"
  | "CREATE_ORDER"
  | "HANDOFF_HUMAN";

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
    "id" | "name" | "phone" | "email" | "city" | "state" | "postalCode"
  >;
  product: Product | null;
  knowledge: ProductKnowledge[];
  settings: AgentSettings | null;
  history: ConversationTurn[];
  /** Optional rolling summary for long conversations (memory strategy). */
  summary?: string | null;
  /**
   * Verified delivery context. Since Logzz exposes no delivery-availability API,
   * this is "unknown" during the conversation — the agent must never claim a
   * date/period unless status is "confirmed" (which only real system data sets).
   */
  delivery?: DeliveryContext;
  /** The new inbound customer message to respond to. */
  incomingMessage: {
    type: MessageType;
    content: string;
  };
  /** Actions the agent is allowed to suggest at this point. */
  availableActions: AgentActionType[];
}

/** Discrete actions the agent may request the orchestration layer to perform. */
export type AgentAction =
  | { type: "SEND_TEXT"; text: string }
  | { type: "REQUEST_CUSTOMER_DATA"; fields: string[] }
  | { type: "CHECK_DELIVERY" }
  // The real, cadastrado checkout URL from the product (never model-generated).
  | { type: "SEND_CHECKOUT"; url?: string }
  | { type: "CREATE_ORDER" }
  | { type: "HANDOFF_HUMAN"; reason: string };

/** Structured result produced by the agent for a single inbound message. */
export interface AgentResponse {
  /** The primary reply text to send back to the customer. */
  reply: string;
  /** Detected customer intent. */
  intent: CustomerIntent;
  /** The stage the conversation should move to (validated by the state machine). */
  nextStage: SalesStage;
  /** Ordered actions the orchestration layer should execute. */
  actions: AgentAction[];
  /** True when the conversation must be handed to a human. */
  requiresHumanHandoff: boolean;
  /** Human-readable reason for the handoff, when applicable. */
  handoffReason?: string;
  /** Customer data fields still needed to advance the sale. */
  dataToCollect: string[];
  /** Whether the customer has expressed intent to buy. */
  purchaseIntent: boolean;
  /** Whether the model signaled the customer wants to finalize/checkout now.
   *  The app — not the model — attaches the real checkout link deterministically. */
  wantsCheckout?: boolean;
  /** Which checkout offer the model selected (0-based index), when the product
   *  has multiple options. The app maps this to the real URL; -1/undefined means
   *  "not chosen" and the app asks the customer which option they want. */
  checkoutOptionIndex?: number | null;
  /** IDs of knowledge items the answer was grounded on (auditability). */
  usedKnowledgeIds: string[];
  /** Model confidence 0..1, when the provider supplies it. */
  confidence?: number;
}

/** Raised when the AI provider is unavailable/unconfigured. Caught by the
 *  orchestration layer to show a friendly message (never leaks internals). */
export class AiUnavailableError extends Error {
  constructor(message = "AI provider is not available") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Abstraction over the text-generation provider (OpenAI, Anthropic, etc.).
 * Concrete implementations build the prompt from `AgentContext`, call the
 * model, and parse a validated structured `AgentResponse`.
 */
export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** @throws {AiUnavailableError} when the provider cannot fulfill the request. */
  generate(context: AgentContext): Promise<AgentResponse>;
}
