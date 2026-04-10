import { MonitorState, MonitorTermKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { settingsKeyboard } from "../src/bot/keyboards/settings";
import { MonitorWithUser } from "../src/modules/monitors/monitor.repository";

function createMonitor(): MonitorWithUser {
  return {
    id: "monitor_1",
    userId: "user_1",
    user: {
      id: "user_1",
      telegramId: "tg_1",
      username: "tester",
      firstName: "Test",
      timezone: "Europe/Moscow",
      dailySummaryEnabled: false,
      weeklySummaryEnabled: false,
      createdAt: new Date("2026-04-07T00:00:00.000Z"),
      updatedAt: new Date("2026-04-07T00:00:00.000Z"),
    },
    name: "Example",
    url: "https://example.com/",
    normalizedUrl: "https://example.com/",
    isActive: true,
    intervalMinutes: 5,
    timeoutMs: 5000,
    consecutiveFailures: 0,
    failureThreshold: 3,
    recoveryThreshold: 1,
    currentState: MonitorState.UP,
    lastCheckedAt: null,
    lastStatusCode: null,
    lastResponseTimeMs: null,
    lastErrorMessage: null,
    requiredText: null,
    checkSsl: false,
    checkJson: false,
    jsonRules: null,
    termKind: MonitorTermKind.TRIAL,
    endsAt: null,
    deletedAt: null,
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
  } as MonitorWithUser;
}

describe("settings keyboard", () => {
  it("does not expose manual timeout editing", () => {
    const keyboard = settingsKeyboard(createMonitor());
    const payload = JSON.stringify(keyboard.reply_markup);

    expect(payload).not.toContain("settings-timeout:");
    expect(payload).toContain("settings-interval:");
    expect(payload).toContain("settings-sensitivity:");
  });
});
