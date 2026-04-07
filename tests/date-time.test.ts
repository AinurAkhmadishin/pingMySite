import { describe, expect, it } from "vitest";

import { addMonths } from "../src/lib/date-time";

describe("date-time helpers", () => {
  it("adds calendar months without skipping shorter months", () => {
    const source = new Date("2026-01-31T10:15:00.000Z");

    const result = addMonths(source, 1);

    expect(result.toISOString()).toBe("2026-02-28T10:15:00.000Z");
  });

  it("adds a year as twelve calendar months", () => {
    const source = new Date("2026-04-07T12:00:00.000Z");

    const result = addMonths(source, 12);

    expect(result.toISOString()).toBe("2027-04-07T12:00:00.000Z");
  });
});
