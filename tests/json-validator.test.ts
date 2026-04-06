import { describe, expect, it } from "vitest";

import { parseJsonRulesText, validateJsonPayload } from "../src/modules/checks/json-validator";

describe("json validator", () => {
  it("parses rules from text and validates json payload", () => {
    const rules = parseJsonRulesText("status = ok\ndata.version exists");
    const result = validateJsonPayload(
      {
        status: "ok",
        data: {
          version: "1.2.3",
        },
      },
      rules,
    );

    expect(result.matched).toBe(true);
  });

  it("fails when a required value does not match", () => {
    const rules = parseJsonRulesText("status = ok");
    const result = validateJsonPayload({ status: "fail" }, rules);

    expect(result.matched).toBe(false);
    expect(result.reason).toContain("не совпало");
  });
});
