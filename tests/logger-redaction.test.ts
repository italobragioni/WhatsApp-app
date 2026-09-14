import { describe, expect, it } from "vitest";

import { redactLogContext } from "@/server/logger/logger";

describe("logger redaction (secret safety)", () => {
  it("redacts sensitive top-level keys", () => {
    const out = redactLogContext({
      accessToken: "SECRET-TOKEN",
      apiKey: "sk-123",
      normal: "ok",
    });
    expect(out.accessToken).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.normal).toBe("ok");
  });

  it("redacts sensitive keys nested inside objects and arrays", () => {
    const out = redactLogContext({
      request: { headers: { Authorization: "Bearer xyz" } },
      items: [{ secret: "s1" }, { ok: "v" }],
    });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("Bearer xyz");
    expect(serialized).not.toContain("s1");
    expect(serialized).toContain("v");
  });

  it("does not choke on null / primitives", () => {
    const out = redactLogContext({ a: null, b: 1, c: "x" });
    expect(out).toEqual({ a: null, b: 1, c: "x" });
  });
});
