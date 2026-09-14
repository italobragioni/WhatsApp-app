import { SalesStage } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canTransition } from "@/server/ai/states";

describe("sales state machine", () => {
  it("allows a valid forward transition", () => {
    expect(
      canTransition(SalesStage.NEW_CONTACT, SalesStage.DISCOVERING_NEED),
    ).toBe(true);
  });

  it("rejects an invalid jump", () => {
    expect(
      canTransition(SalesStage.NEW_CONTACT, SalesStage.ORDER_PLACED),
    ).toBe(false);
  });

  it("allows handoff to human from any stage", () => {
    expect(
      canTransition(SalesStage.PRESENTING_PRODUCT, SalesStage.HANDOFF_HUMAN),
    ).toBe(true);
    expect(
      canTransition(SalesStage.NEW_CONTACT, SalesStage.HANDOFF_HUMAN),
    ).toBe(true);
  });

  it("allows staying in the same stage", () => {
    expect(
      canTransition(SalesStage.ANSWERING_QUESTION, SalesStage.ANSWERING_QUESTION),
    ).toBe(true);
  });
});
