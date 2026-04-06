import { describe, expect, it } from "vitest";

import { createMonitorSchema } from "../src/modules/monitors/monitor.schemas";

describe("monitor creation validation", () => {
  it("accepts a valid monitor payload", () => {
    const parsed = createMonitorSchema.parse({
      userId: "user_1",
      name: "My API",
      url: "https://example.com",
      intervalMinutes: 5,
      timeoutMs: 5000,
      requiredText: null,
      checkSsl: true,
      checkJson: false,
      jsonRules: null,
      failureThreshold: 3,
      recoveryThreshold: 1,
    });

    expect(parsed.intervalMinutes).toBe(5);
    expect(parsed.name).toBe("My API");
  });

  it("rejects unsupported monitoring interval", () => {
    expect(() =>
      createMonitorSchema.parse({
        userId: "user_1",
        name: "My API",
        url: "https://example.com",
        intervalMinutes: 2,
        timeoutMs: 5000,
        requiredText: null,
        checkSsl: false,
        checkJson: false,
        jsonRules: null,
        failureThreshold: 3,
        recoveryThreshold: 1,
      }),
    ).toThrow();
  });
});
