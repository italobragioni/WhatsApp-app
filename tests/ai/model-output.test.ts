import { SalesStage } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  mapModelOutput,
  modelOutputSchema,
} from "@/server/ai/model-output";

import { makeContext, makeProduct } from "../helpers";

function raw(overrides: Record<string, unknown> = {}) {
  return modelOutputSchema.parse({
    reply: "Olá!",
    intent: "GREETING",
    next_stage: "DISCOVERING_NEED",
    ...overrides,
  });
}

describe("model output mapping", () => {
  it("applies defaults for optional fields", () => {
    const parsed = modelOutputSchema.parse({ reply: "oi" });
    expect(parsed.requires_human_handoff).toBe(false);
    expect(parsed.data_to_collect).toEqual([]);
    expect(parsed.wants_checkout).toBe(false);
  });

  it("simple reply produces only a SEND_TEXT action", () => {
    const res = mapModelOutput(raw(), makeContext());
    expect(res.actions).toHaveLength(1);
    expect(res.actions[0]).toEqual({ type: "SEND_TEXT", text: "Olá!" });
  });

  it("emits REQUEST_CUSTOMER_DATA when fields are needed", () => {
    const res = mapModelOutput(
      raw({ data_to_collect: ["cep", "endereço"] }),
      makeContext(),
    );
    expect(res.actions).toContainEqual({
      type: "REQUEST_CUSTOMER_DATA",
      fields: ["cep", "endereço"],
    });
  });

  it("emits SEND_CHECKOUT only when a checkout URL exists", () => {
    const withUrl = makeContext({
      product: makeProduct({ checkoutUrl: "https://checkout.example/x" }),
    });
    const res = mapModelOutput(
      raw({ wants_checkout: true, purchase_intent: true }),
      withUrl,
    );
    const action = res.actions.find((a) => a.type === "SEND_CHECKOUT");
    expect(action).toEqual({
      type: "SEND_CHECKOUT",
      url: "https://checkout.example/x",
    });
  });

  it("does NOT emit SEND_CHECKOUT without a checkout URL", () => {
    const res = mapModelOutput(
      raw({ wants_checkout: true, purchase_intent: true }),
      makeContext({ product: makeProduct({ checkoutUrl: null }) }),
    );
    expect(res.actions.some((a) => a.type === "SEND_CHECKOUT")).toBe(false);
  });

  it("forces HANDOFF_HUMAN stage and action on handoff", () => {
    const res = mapModelOutput(
      raw({
        requires_human_handoff: true,
        handoff_reason: "cliente irritado",
      }),
      makeContext(),
    );
    expect(res.nextStage).toBe(SalesStage.HANDOFF_HUMAN);
    expect(res.requiresHumanHandoff).toBe(true);
    expect(res.actions.some((a) => a.type === "HANDOFF_HUMAN")).toBe(true);
  });
});
