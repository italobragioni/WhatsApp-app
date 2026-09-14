import { MessageType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MessagingProvider, NormalizedInboundMessage } from "@/server/integrations/types";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    integrationEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    message: { update: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/server/services/customer.service", () => ({
  upsertCustomerByPhone: vi.fn(),
}));
vi.mock("@/server/services/conversation.service", () => ({
  getOrCreateOpenConversation: vi.fn(),
}));
vi.mock("@/server/services/conversation-agent.service", () => ({
  runCustomerTurn: vi.fn(),
}));
vi.mock("@/server/services/message.service", () => ({
  appendMessage: vi.fn().mockResolvedValue({ id: "m" }),
}));

const { processIncomingWhatsAppMessage } = await import(
  "@/server/services/whatsapp-webhook.service"
);
const { prisma } = await import("@/server/db/prisma");
const { upsertCustomerByPhone } = await import(
  "@/server/services/customer.service"
);
const { getOrCreateOpenConversation } = await import(
  "@/server/services/conversation.service"
);
const { runCustomerTurn } = await import(
  "@/server/services/conversation-agent.service"
);

const evFindUnique = vi.mocked(prisma.integrationEvent.findUnique);
const evCreate = vi.mocked(prisma.integrationEvent.create);
const evUpdate = vi.mocked(prisma.integrationEvent.update);
const msgUpdate = vi.mocked(prisma.message.update);
const upsertCustomer = vi.mocked(upsertCustomerByPhone);
const getConv = vi.mocked(getOrCreateOpenConversation);
const runTurn = vi.mocked(runCustomerTurn);

function mockProvider(sendResult: unknown = { ok: true, data: { externalId: "wamid.OUT" } }) {
  return {
    name: "mock",
    type: "WHATSAPP",
    isConfigured: () => true,
    sendText: vi.fn().mockResolvedValue(sendResult),
    sendMedia: vi.fn(),
    downloadMedia: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    parseInboundWebhook: vi.fn(),
  } as unknown as MessagingProvider & { sendText: ReturnType<typeof vi.fn> };
}

function inbound(overrides: Partial<NormalizedInboundMessage> = {}): NormalizedInboundMessage {
  return {
    externalId: "wamid.IN",
    from: "5511999999999",
    contactName: "João",
    type: MessageType.TEXT,
    text: "Olá",
    raw: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  evUpdate.mockResolvedValue({} as never);
  msgUpdate.mockResolvedValue({} as never);
  upsertCustomer.mockResolvedValue({ id: "cust1" } as never);
  getConv.mockResolvedValue({ id: "conv1", agentMode: "ACTIVE" } as never);
});

describe("processIncomingWhatsAppMessage", () => {
  it("processes a new ACTIVE text message and delivers the reply", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    runTurn.mockResolvedValue({
      status: "ok",
      customerMessage: { id: "cm" },
      agentMessage: { id: "am", metadata: {} },
      response: { reply: "Oi!" },
    } as never);
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(inbound(), { provider });

    expect(upsertCustomer).toHaveBeenCalledWith("5511999999999", { name: "João" });
    expect(runTurn).toHaveBeenCalledWith(
      "conv1",
      "Olá",
      expect.objectContaining({ externalId: "wamid.IN", type: MessageType.TEXT }),
    );
    expect(provider.sendText).toHaveBeenCalledWith({ to: "5511999999999", text: "Oi!" });
    expect(msgUpdate).toHaveBeenCalled(); // stores providerMessageId
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
    expect(result.status).toBe("ok");
  });

  it("skips a duplicate (already processed) event without calling the AI", async () => {
    evFindUnique.mockResolvedValue({ id: "ev1", processed: true } as never);
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(inbound(), { provider });

    expect(result.status).toBe("duplicate");
    expect(runTurn).not.toHaveBeenCalled();
    expect(provider.sendText).not.toHaveBeenCalled();
    expect(evCreate).not.toHaveBeenCalled();
  });

  it("does not send when the conversation is not ACTIVE", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    runTurn.mockResolvedValue({ status: "skipped", reason: "not_active" } as never);
    const provider = mockProvider();

    await processIncomingWhatsAppMessage(inbound(), { provider });

    expect(provider.sendText).not.toHaveBeenCalled();
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
  });

  it("does not send when the AI errors, but still acks", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    runTurn.mockResolvedValue({ status: "error", message: "indisponível" } as never);
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(inbound(), { provider });

    expect(provider.sendText).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("records unsupported types, replies politely, and never calls the AI", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(
      inbound({ type: MessageType.IMAGE, text: undefined, mediaId: "media-1" }),
      { provider },
    );

    expect(runTurn).not.toHaveBeenCalled();
    expect(provider.sendText).toHaveBeenCalledOnce();
    expect(result.status).toBe("unsupported");
  });

  it("handles a Meta send failure gracefully (marks delivery error, still acks)", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    runTurn.mockResolvedValue({
      status: "ok",
      customerMessage: { id: "cm" },
      agentMessage: { id: "am", metadata: {} },
      response: { reply: "Oi!" },
    } as never);
    const provider = mockProvider({ ok: false, error: "boom", code: "network" });

    const result = await processIncomingWhatsAppMessage(inbound(), { provider });

    expect(provider.sendText).toHaveBeenCalled();
    expect(msgUpdate).toHaveBeenCalled(); // marked delivery: error
    expect(result.status).toBe("ok");
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
  });
});

function audioInbound(): NormalizedInboundMessage {
  return {
    externalId: "wamid.AUDIO",
    from: "5511999999999",
    type: MessageType.AUDIO,
    mediaId: "media-1",
    mimeType: "audio/ogg",
    raw: {},
  };
}

describe("processIncomingWhatsAppMessage (audio)", () => {
  it("transcribes and feeds the SAME agent pipeline, then replies", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    const transcribeAudio = vi.fn().mockResolvedValue({
      status: "ok",
      text: "vocês entregam hoje?",
      model: "m",
      meta: { mediaId: "media-1", mimeType: "audio/ogg", waTimestamp: null, totalMs: 5 },
    });
    runTurn.mockResolvedValue({
      status: "ok",
      customerMessage: { id: "cm" },
      agentMessage: { id: "am", metadata: {} },
      response: { reply: "Sim, posso verificar!" },
    } as never);
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(audioInbound(), {
      provider,
      transcribeAudio,
    });

    // The transcription becomes the text the agent sees; type stays AUDIO.
    expect(runTurn).toHaveBeenCalledWith(
      "conv1",
      "vocês entregam hoje?",
      expect.objectContaining({ type: MessageType.AUDIO, externalId: "wamid.AUDIO" }),
    );
    expect(provider.sendText).toHaveBeenCalledWith({
      to: "5511999999999",
      text: "Sim, posso verificar!",
    });
    expect(result.status).toBe("ok");
  });

  it("on transcription failure: records audio, replies politely, never calls the AI", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    const transcribeAudio = vi.fn().mockResolvedValue({
      status: "transcription_error",
      meta: { mediaId: "media-1", mimeType: "audio/ogg", waTimestamp: null },
    });
    const provider = mockProvider();

    const result = await processIncomingWhatsAppMessage(audioInbound(), {
      provider,
      transcribeAudio,
    });

    expect(runTurn).not.toHaveBeenCalled();
    expect(provider.sendText).toHaveBeenCalledOnce(); // friendly message
    expect(result.status).toBe("audio_failed");
    expect(evUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
  });

  it("does not reply for audio in a non-ACTIVE conversation", async () => {
    evFindUnique.mockResolvedValue(null);
    evCreate.mockResolvedValue({ id: "ev1" } as never);
    getConv.mockResolvedValue({ id: "conv1", agentMode: "PAUSED" } as never);
    const transcribeAudio = vi.fn().mockResolvedValue({
      status: "ok",
      text: "oi",
      model: "m",
      meta: { mediaId: "media-1", mimeType: "audio/ogg", waTimestamp: null },
    });
    runTurn.mockResolvedValue({ status: "skipped", reason: "not_active" } as never);
    const provider = mockProvider();

    await processIncomingWhatsAppMessage(audioInbound(), { provider, transcribeAudio });

    expect(provider.sendText).not.toHaveBeenCalled();
  });
});
