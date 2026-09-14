import { AgentMode, SalesStage } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SalesAgent } from "@/server/ai/sales-agent";
import type { AgentResponse } from "@/server/ai/types";
import { AiUnavailableError } from "@/server/ai/types";

import { makeContext } from "../helpers";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/server/services/message.service", () => ({
  appendMessage: vi.fn(),
}));

// Imported after the mocks are registered.
const { runCustomerTurn } = await import(
  "@/server/services/conversation-agent.service"
);
const { prisma } = await import("@/server/db/prisma");
const { appendMessage } = await import("@/server/services/message.service");

const findUnique = vi.mocked(prisma.conversation.findUnique);
const update = vi.mocked(prisma.conversation.update);
const appendMock = vi.mocked(appendMessage);

function agentResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    reply: "Resposta",
    intent: "QUESTION",
    nextStage: SalesStage.ANSWERING_QUESTION,
    actions: [{ type: "SEND_TEXT", text: "Resposta" }],
    requiresHumanHandoff: false,
    dataToCollect: [],
    purchaseIntent: false,
    usedKnowledgeIds: [],
    ...overrides,
  };
}

function makeAgent(
  response: AgentResponse | Error,
): { agent: SalesAgent; generate: ReturnType<typeof vi.fn> } {
  const generate = vi.fn();
  if (response instanceof Error) {
    generate.mockRejectedValue(response);
  } else {
    generate.mockResolvedValue(response);
  }
  const agent = {
    shouldAutoRespond: (c: { agentMode: AgentMode }) =>
      c.agentMode === AgentMode.ACTIVE,
    buildContext: vi.fn().mockResolvedValue(makeContext()),
    generateResponse: generate,
  } as unknown as SalesAgent;
  return { agent, generate };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({} as never);
});

describe("runCustomerTurn", () => {
  it("skips empty messages without persisting", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      agentMode: AgentMode.ACTIVE,
    } as never);
    const { agent, generate } = makeAgent(agentResponse());

    const result = await runCustomerTurn("c1", "   ", { agent });

    expect(result.status).toBe("skipped");
    expect(appendMock).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not call the model when the conversation is not ACTIVE", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      agentMode: AgentMode.PAUSED,
    } as never);
    appendMock.mockResolvedValue({ id: "m_customer" } as never);
    const { agent, generate } = makeAgent(agentResponse());

    const result = await runCustomerTurn("c1", "Oi", { agent });

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("not_active");
    expect(appendMock).toHaveBeenCalledTimes(1); // only the customer message
    expect(generate).not.toHaveBeenCalled();
  });

  it("runs the agent and persists the reply for an ACTIVE conversation", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      agentMode: AgentMode.ACTIVE,
    } as never);
    appendMock
      .mockResolvedValueOnce({ id: "m_customer" } as never)
      .mockResolvedValueOnce({ id: "m_agent" } as never);
    const { agent, generate } = makeAgent(agentResponse());

    const result = await runCustomerTurn("c1", "Como funciona?", { agent });

    expect(generate).toHaveBeenCalledOnce();
    expect(appendMock).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ stage: SalesStage.ANSWERING_QUESTION }),
      }),
    );
    expect(result.status).toBe("ok");
  });

  it("switches to HUMAN mode on handoff", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      agentMode: AgentMode.ACTIVE,
    } as never);
    appendMock.mockResolvedValue({ id: "m" } as never);
    const { agent } = makeAgent(
      agentResponse({
        requiresHumanHandoff: true,
        nextStage: SalesStage.HANDOFF_HUMAN,
        handoffReason: "quer falar com humano",
        actions: [
          { type: "SEND_TEXT", text: "Vou te transferir" },
          { type: "HANDOFF_HUMAN", reason: "quer falar com humano" },
        ],
      }),
    );

    await runCustomerTurn("c1", "quero falar com uma pessoa", { agent });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentMode: AgentMode.HUMAN }),
      }),
    );
  });

  it("returns a friendly error (and still saves the customer message) when the AI is unavailable", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      agentMode: AgentMode.ACTIVE,
    } as never);
    appendMock.mockResolvedValue({ id: "m_customer" } as never);
    const { agent } = makeAgent(new AiUnavailableError());

    const result = await runCustomerTurn("c1", "Oi", { agent });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/indispon/i);
      expect(result.message).not.toMatch(/stack|api|key/i);
    }
    // customer message saved, no agent message
    expect(appendMock).toHaveBeenCalledTimes(1);
  });
});
