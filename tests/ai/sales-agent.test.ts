import { AgentMode, SalesStage } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { SalesAgent } from "@/server/ai/sales-agent";
import type { AgentResponse, AiProvider } from "@/server/ai/types";

import { makeContext, makeProduct } from "../helpers";

function providerReturning(response: AgentResponse): AiProvider {
  return {
    name: "mock",
    isConfigured: () => true,
    generate: async () => response,
  };
}

function response(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    reply: "Olá!",
    intent: "GREETING",
    nextStage: SalesStage.DISCOVERING_NEED,
    actions: [{ type: "SEND_TEXT", text: "Olá!" }],
    requiresHumanHandoff: false,
    dataToCollect: [],
    purchaseIntent: false,
    usedKnowledgeIds: [],
    ...overrides,
  };
}

describe("SalesAgent.shouldAutoRespond", () => {
  const agent = new SalesAgent(providerReturning(response()));

  it("responds only when ACTIVE", () => {
    expect(agent.shouldAutoRespond({ agentMode: AgentMode.ACTIVE })).toBe(true);
    expect(agent.shouldAutoRespond({ agentMode: AgentMode.PAUSED })).toBe(false);
    expect(agent.shouldAutoRespond({ agentMode: AgentMode.HUMAN })).toBe(false);
  });
});

describe("SalesAgent.generateResponse (guardrailed)", () => {
  it("passes through a valid response", async () => {
    const agent = new SalesAgent(providerReturning(response()));
    const res = await agent.generateResponse(makeContext());
    expect(res.reply).toBe("Olá!");
    expect(res.nextStage).toBe(SalesStage.DISCOVERING_NEED);
  });

  it("resets an invalid transition", async () => {
    const agent = new SalesAgent(
      providerReturning(response({ nextStage: SalesStage.ORDER_PLACED })),
    );
    const res = await agent.generateResponse(
      makeContext({ stage: SalesStage.NEW_CONTACT }),
    );
    expect(res.nextStage).toBe(SalesStage.NEW_CONTACT);
  });

  it("gates checkout when there is no checkout URL", async () => {
    const agent = new SalesAgent(
      providerReturning(
        response({
          actions: [
            { type: "SEND_TEXT", text: "Vamos fechar?" },
            { type: "SEND_CHECKOUT" },
          ],
        }),
      ),
    );
    const res = await agent.generateResponse(
      makeContext({ product: makeProduct({ checkoutUrl: null }) }),
    );
    expect(res.actions.some((a) => a.type === "SEND_CHECKOUT")).toBe(false);
  });
});
