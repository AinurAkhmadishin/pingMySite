import { describe, expect, it } from "vitest";

import { validateRequiredText } from "../src/modules/checks/content-validator";

describe("content validator", () => {
  it("returns success when required text is found", () => {
    const result = validateRequiredText("service status: ok", "status: ok");
    expect(result.matched).toBe(true);
  });

  it("returns failure when required text is missing", () => {
    const result = validateRequiredText("service status: down", "status: ok");
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("Не найден");
  });
});
