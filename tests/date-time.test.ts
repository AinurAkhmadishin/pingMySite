import { describe, expect, it } from "vitest";

import { addMonths, formatTimeOfDay, getMoscowTimeMinutes, getStartOfMoscowDay, parseTimeOfDay } from "../src/lib/date-time";

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

  it("parses and formats time of day for daily summaries", () => {
    expect(parseTimeOfDay("09:30")).toBe(570);
    expect(parseTimeOfDay("9.45")).toBe(585);
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(formatTimeOfDay(570)).toBe("09:30");
  });

  it("calculates Moscow current minute and start of day from UTC", () => {
    const now = new Date("2026-04-11T06:30:00.000Z");

    expect(getMoscowTimeMinutes(now)).toBe(570);
    expect(getStartOfMoscowDay(now).toISOString()).toBe("2026-04-10T21:00:00.000Z");
  });
});
