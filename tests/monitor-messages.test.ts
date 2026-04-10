import { MonitorState, MonitorTermKind } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildMonitorListMessage, buildReportMessage, buildStatusMessage } from "../src/bot/messages/monitor-messages";
import { formatDateTime } from "../src/lib/date-time";
import { MonitorWithUser } from "../src/modules/monitors/monitor.repository";
import { MonitorReport } from "../src/modules/reports/report.service";

function createMonitor(overrides: Partial<MonitorWithUser> = {}): MonitorWithUser {
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
    requiredText: null,
    checkSsl: false,
    checkJson: false,
    jsonRules: null,
    termKind: MonitorTermKind.TRIAL,
    endsAt: null,
    billingLocked: false,
    deletedAt: null,
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
    ...overrides,
  } as MonitorWithUser;
}

describe("monitor messages", () => {
  it("shows monitoring end date in list output", () => {
    const endsAt = new Date("2026-04-10T10:30:00.000Z");
    const message = buildMonitorListMessage([createMonitor({ endsAt })]);

    expect(message).toContain(formatDateTime(endsAt, "Europe/Moscow"));
  });

  it("shows monitoring end date in report output", () => {
    const endsAt = new Date("2026-04-10T10:30:00.000Z");
    const report: MonitorReport = {
      monitorId: "monitor_1",
      monitorName: "Example",
      url: "https://example.com/",
      currentState: "UP",
      endsAt,
      averageResponseTimeMs: 120,
      totalIncidents: 1,
      lastIncidentReason: "Timeout",
      lastIncidentStartedAt: new Date("2026-04-07T09:00:00.000Z"),
      openIncident: false,
      windows: [
        {
          label: "24h",
          totalChecks: 10,
          successfulChecks: 10,
          uptimePercent: 100,
        },
      ],
      recentIncidents: [],
    };

    const message = buildReportMessage(report, "Europe/Moscow");

    expect(message).toContain(formatDateTime(endsAt, "Europe/Moscow"));
  });

  it("shows expired state when a monitor is billing-locked", () => {
    const message = buildStatusMessage([
      createMonitor({
        billingLocked: true,
        currentState: MonitorState.PAUSED,
        isActive: false,
      }),
    ]);

    expect(message).toContain("EXPIRED");
  });

  it("does not mention legacy region sections in report output", () => {
    const message = buildReportMessage(
      {
        monitorId: "monitor_1",
        monitorName: "Example",
        url: "https://example.com/",
        currentState: "UP",
        endsAt: null,
        averageResponseTimeMs: 120,
        totalIncidents: 0,
        openIncident: false,
        windows: [],
        recentIncidents: [],
      },
      "Europe/Moscow",
    );

    expect(message).not.toContain("[RU]");
    expect(message).not.toContain("[GLOBAL]");
  });
});
