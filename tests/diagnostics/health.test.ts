import { describe, expect, it } from "vitest";

import { getSystemHealth } from "@/server/diagnostics/health";

describe("getSystemHealth (config-only diagnostics)", () => {
  it("reports each integration with a boolean, never a secret value", () => {
    const health = getSystemHealth();
    const keys = health.checks.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "database",
        "auth",
        "openai",
        "transcription",
        "whatsapp",
        "logzz",
      ]),
    );

    // WhatsApp + Logzz secrets are set in the test env; the diagnostics output
    // must never contain their values.
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("app-secret-test");
    expect(serialized).not.toContain("verify-token-test");
    expect(serialized).not.toContain("logzz-secret-test");
    expect(serialized).not.toContain("test-secret-0123456789abcdef");
  });

  it("is not production-ready when a required integration is missing", () => {
    // OPENAI_API_KEY is not set in the test env, so openai is unconfigured.
    const health = getSystemHealth();
    const openai = health.checks.find((c) => c.key === "openai");
    expect(openai?.configured).toBe(false);
    expect(health.productionReady).toBe(false);
  });
});
