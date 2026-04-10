import { MonitorState, MonitorTermKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildManualCheckMessage } from "../src/modules/notifications/message-builder";
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
    lastCheckedAt: new Date("2026-04-07T10:00:00.000Z"),
    lastStatusCode: 200,
    lastResponseTimeMs: 120,
    lastErrorMessage: null,
    requiredText: "Example",
    checkSsl: false,
    checkJson: true,
    jsonRules: null,
    termKind: MonitorTermKind.TRIAL,
    endsAt: null,
    billingLocked: false,
    deletedAt: null,
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
  } as MonitorWithUser;
}

describe("manual check message", () => {
  it("shows common check results once without region sections", () => {
    const message = buildManualCheckMessage(createMonitor(), {
      success: false,
      statusCode: 451,
      responseTimeMs: 321,
      checkedAt: new Date("2026-04-07T10:00:00.000Z"),
      contentMatched: false,
      jsonMatched: false,
      errorMessage: "HTTP 451",
    });

    expect(message).toContain("Проект: Example");
    expect(message).toContain("Текст найден: нет");
    expect(message).toContain("JSON валиден: нет");
    expect(message).not.toContain("[RU]");
    expect(message).not.toContain("[GLOBAL]");
  });
});
