import { AgentMode, MessageType, type Conversation } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { getGroundingKnowledge } from "@/server/services/knowledge.service";
import { getAgentSettings } from "@/server/services/agent-settings.service";

import { AI_CONFIG } from "./config";
import { computeAvailableActions, postProcessResponse } from "./guardrails";
import { getAiProvider } from "./provider";
import type {
  AgentContext,
  AgentResponse,
  AiProvider,
  ConversationTurn,
} from "./types";

/**
 * AI Sales Agent orchestrator.
 *
 * Responsibilities:
 *  - Enforce human-in-the-loop: never auto-respond when a conversation is
 *    paused or handed to a human (`shouldAutoRespond`).
 *  - Assemble the grounded `AgentContext` from the database (customer, product,
 *    curated knowledge, settings, recent history) — the ONLY facts the agent
 *    may use.
 *  - Delegate text generation to a swappable `AiProvider`.
 *  - Apply guardrails (state machine + action gating) to the provider output.
 */
export class SalesAgent {
  private readonly provider: AiProvider;

  constructor(provider: AiProvider = getAiProvider()) {
    this.provider = provider;
  }

  /** Human-in-the-loop guard: only ACTIVE conversations get auto-responses. */
  shouldAutoRespond(conversation: Pick<Conversation, "agentMode">): boolean {
    return conversation.agentMode === AgentMode.ACTIVE;
  }

  /** Assemble everything the agent is allowed to reason over. */
  async buildContext(
    conversationId: string,
    incoming: { type: MessageType; content: string },
    historyLimit = AI_CONFIG.historyLimit,
  ): Promise<AgentContext> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        customer: true,
        product: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: historyLimit,
        },
      },
    });

    const [knowledge, settings] = await Promise.all([
      conversation.productId
        ? getGroundingKnowledge(conversation.productId)
        : Promise.resolve([]),
      getAgentSettings(),
    ]);

    const history: ConversationTurn[] = conversation.messages
      .slice()
      .reverse()
      .map((m) => ({ sender: m.sender, type: m.type, content: m.content }));

    const product = conversation.product;

    return {
      conversationId,
      stage: conversation.stage,
      summary: conversation.summary,
      customer: {
        id: conversation.customer.id,
        name: conversation.customer.name,
        phone: conversation.customer.phone,
        email: conversation.customer.email,
        city: conversation.customer.city,
        state: conversation.customer.state,
        postalCode: conversation.customer.postalCode,
      },
      product,
      knowledge,
      settings,
      history,
      incomingMessage: incoming,
      availableActions: computeAvailableActions({ product }),
      // No Logzz delivery-availability API exists; delivery is confirmed only
      // inside the checkout. So the agent's delivery context is always unknown
      // here and it must not claim any date/period (see guardrails).
      delivery: { status: "unknown" },
    };
  }

  /**
   * Produce a guardrailed structured response for the given context.
   * @throws {AiUnavailableError} when the provider cannot fulfill the request.
   */
  async generateResponse(context: AgentContext): Promise<AgentResponse> {
    const raw = await this.provider.generate(context);
    return postProcessResponse(raw, context);
  }
}

export const salesAgent = new SalesAgent();
