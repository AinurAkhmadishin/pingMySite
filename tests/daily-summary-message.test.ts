import { describe, expect, it } from "vitest";

import { buildDailySummaryMessage } from "../src/modules/notifications/message-builder";

describe("daily summary message", () => {
  it("shows current status counts and problematic monitors", () => {
    const message = buildDailySummaryMessage({
      activeMonitorCount: 3,
      pausedMonitorCount: 1,
      upCount: 1,
      downCount: 1,
      unknownCount: 1,
      timeZone: "Europe/Moscow",
      problematicMonitors: [
        {
          name: "API",
          url: "https://api.example.com",
          state: "DOWN",
          lastCheckedAt: new Date("2026-04-11T06:20:00.000Z"),
          lastErrorMessage: "Timeout",
        },
      ],
    });

    expect(message).toContain("Ежедневная сводка");
    expect(message).toContain("Активных мониторов: 3");
    expect(message).toContain("DOWN: 1");
    expect(message).toContain("На паузе: 1");
    expect(message).toContain("API - DOWN");
    expect(message).toContain("Timeout");
  });

  it("shows healthy text when all active monitors are up", () => {
    const message = buildDailySummaryMessage({
      activeMonitorCount: 2,
      pausedMonitorCount: 0,
      upCount: 2,
      downCount: 0,
      unknownCount: 0,
      timeZone: "Europe/Moscow",
      problematicMonitors: [],
    });

    expect(message).toContain("Все активные мониторы сейчас в порядке.");
  });
});
