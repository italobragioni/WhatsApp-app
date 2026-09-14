import { AgentMode, MessageType, type Conversation } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger/logger";
import { getGroundingKnowledge } from "@/server/services/knowledge.service";
import { getAgentSettings } from "@/server/services/agent-settings.service";

import { getAiProvider } from "./provider";
import { canTransition } from "./states";
import type {
  AgentContext,
  AgentResponse,
  AiProvider,
  ConversationTurn,
} from "./types";

/**
 * AI Sales Agent orchestrator.
 *
 * Responsibilities that ARE implemented now (no external calls needed):
 *  - Enforce human-in-the-loop: never auto-respond when the conversation is
 *    paused or handed to a human.
 *  - Assemble the grounded `AgentContext` from the database (customer, product,
 *    curated knowledge, settings, recent history).
 *  - Validate stage transitions produced by the provider.
 *
 * Responsibility that is NOT implemented yet:
 *  - The actual text generation, which depends on an AI provider that is not
 *    connected. `generateResponse` will surface NotImplementedError until then.
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
    historyLimit = 20,
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

    return {
      conversationId,
      stage: conversation.stage,
      customer: {
        id: conversation.customer.id,
        name: conversation.customer.name,
        phone: conversation.customer.phone,
        city: conversation.customer.city,
        state: conversation.customer.state,
        postalCode: conversation.customer.postalCode,
      },
      product: conversation.product,
      knowledge,
      settings,
      history,
      incomingMessage: incoming,
    };
  }

  /**
   * Produce a structured response for the given context.
   * @throws {NotImplementedError} until an AI provider is connected.
   */
  async generateResponse(context: AgentContext): Promise<AgentResponse> {
    const response = await this.provider.generate(context);

    // Guard the state machine even against a misbehaving provider.
    if (!canTransition(context.stage, response.nextStage)) {
      logger.warn("sales-agent", "Rejected invalid stage transition", {
        from: context.stage,
        to: response.nextStage,
      });
      response.nextStage = context.stage;
    }

    return response;
  }
}

export const salesAgent = new SalesAgent();
