import { IncidentStatus, MonitorState } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { DashboardService } from "../src/modules/dashboard/dashboard.service";

function createPrismaMock() {
  return {
    user: {
      count: vi.fn(),
    },
    monitor: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    incident: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    checkResult: {
      findMany: vi.fn(),
    },
    notificationLog: {
      findMany: vi.fn(),
    },
  };
}

describe("dashboard service", () => {
  it("builds overview metrics from monitors and checks", async () => {
    const prisma = createPrismaMock();
    prisma.user.count.mockResolvedValue(2);
    prisma.monitor.findMany.mockResolvedValue([
      {
        id: "monitor_1",
        name: "Main",
        url: "https://example.com/",
        currentState: MonitorState.UP,
        isActive: true,
        user: {
          id: "user_1",
          telegramId: "1",
          username: "alpha",
          firstName: "Alpha",
          timezone: "Europe/Moscow",
        },
      },
      {
        id: "monitor_2",
        name: "Backup",
        url: "https://backup.example.com/",
        currentState: MonitorState.DOWN,
        isActive: true,
        user: {
          id: "user_2",
          telegramId: "2",
          username: "beta",
          firstName: "Beta",
          timezone: "Europe/Moscow",
        },
      },
    ]);
    prisma.incident.count.mockResolvedValue(1);
    prisma.checkResult.findMany.mockResolvedValue([
      {
        monitorId: "monitor_1",
        success: true,
        responseTimeMs: 200,
        checkedAt: new Date("2026-04-08T10:00:00.000Z"),
      },
      {
        monitorId: "monitor_2",
        success: false,
        responseTimeMs: 900,
        checkedAt: new Date("2026-04-08T10:05:00.000Z"),
      },
    ]);
    prisma.incident.findMany.mockResolvedValue([
      {
        id: "incident_1",
        monitorId: "monitor_2",
        reason: "HTTP 500",
        status: IncidentStatus.OPEN,
        startedAt: new Date("2026-04-08T09:00:00.000Z"),
        resolvedAt: null,
        durationSeconds: null,
        monitor: {
          id: "monitor_2",
          name: "Backup",
          url: "https://backup.example.com/",
          user: {
            id: "user_2",
            telegramId: "2",
            username: "beta",
            firstName: "Beta",
            timezone: "Europe/Moscow",
          },
        },
      },
    ]);

    const workerHealthService = {
      getWorkerStatus: vi.fn().mockResolvedValue({
        isAlive: true,
        pid: 123,
        startedAt: new Date("2026-04-08T08:00:00.000Z"),
        updatedAt: new Date("2026-04-08T10:10:00.000Z"),
        ageSeconds: 10,
        staleAfterSeconds: 90,
      }),
    };
    const monitorHealthService = {
      getStuckUnknownSummary: vi.fn().mockResolvedValue({
        count: 0,
        staleAfterMinutes: 15,
        thresholdStartedBefore: new Date("2026-04-08T09:45:00.000Z"),
        monitors: [],
      }),
    };

    const service = new DashboardService(prisma as never, workerHealthService as never, monitorHealthService as never);
    const overview = await service.getOverview(new Date("2026-04-08T10:15:00.000Z"));

    expect(overview.totals.users).toBe(2);
    expect(overview.totals.monitors).toBe(2);
    expect(overview.totals.downMonitors).toBe(1);
    expect(overview.totals.failedChecksLast24h).toBe(1);
    expect(overview.totals.averageUptimePercent24h).toBe(50);
    expect(overview.slowestMonitors[0]).toMatchObject({
      monitorId: "monitor_1",
      averageResponseTimeMs: 200,
    });
    expect(overview.recentIncidents).toHaveLength(1);
  });

  it("builds detailed monitor payload with windows, checks, incidents and notifications", async () => {
    const prisma = createPrismaMock();
    prisma.monitor.findFirst.mockResolvedValue({
      id: "monitor_1",
      name: "Main",
      url: "https://example.com/",
      currentState: MonitorState.UP,
      isActive: true,
      intervalMinutes: 5,
      timeoutMs: 5000,
      consecutiveFailures: 0,
      failureThreshold: 3,
      recoveryThreshold: 1,
      lastCheckedAt: new Date("2026-04-08T10:00:00.000Z"),
      lastStatusCode: 200,
      lastResponseTimeMs: 320,
      lastErrorMessage: null,
      requiredText: null,
      checkSsl: true,
      checkJson: false,
      endsAt: null,
      createdAt: new Date("2026-04-07T10:00:00.000Z"),
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
      user: {
        id: "user_1",
        telegramId: "1",
        username: "alpha",
        firstName: "Alpha",
        timezone: "Europe/Moscow",
      },
      incidents: [],
      _count: {
        incidents: 2,
      },
    });
    prisma.checkResult.findMany.mockResolvedValue([
      {
        id: "check_1",
        monitorId: "monitor_1",
        checkedAt: new Date("2026-04-08T10:00:00.000Z"),
        success: true,
        statusCode: 200,
        responseTimeMs: 320,
        errorMessage: null,
        contentMatched: null,
        jsonMatched: null,
      },
      {
        id: "check_2",
        monitorId: "monitor_1",
        checkedAt: new Date("2026-04-08T09:55:00.000Z"),
        success: false,
        statusCode: 500,
        responseTimeMs: 800,
        errorMessage: "HTTP 500",
        contentMatched: null,
        jsonMatched: null,
      },
    ]);
    prisma.incident.findMany.mockResolvedValue([
      {
        id: "incident_1",
        monitorId: "monitor_1",
        reason: "HTTP 500",
        status: IncidentStatus.RESOLVED,
        startedAt: new Date("2026-04-08T09:50:00.000Z"),
        resolvedAt: new Date("2026-04-08T09:55:00.000Z"),
        durationSeconds: 300,
        monitor: {
          id: "monitor_1",
          name: "Main",
          url: "https://example.com/",
          user: {
            id: "user_1",
            telegramId: "1",
            username: "alpha",
            firstName: "Alpha",
            timezone: "Europe/Moscow",
          },
        },
      },
    ]);
    prisma.notificationLog.findMany.mockResolvedValue([
      {
        id: "notification_1",
        type: "RECOVERED",
        sentAt: new Date("2026-04-08T09:56:00.000Z"),
        payload: {
          statusCode: 200,
        },
      },
    ]);

    const service = new DashboardService(
      prisma as never,
      { getWorkerStatus: vi.fn() } as never,
      { getStuckUnknownSummary: vi.fn() } as never,
    );
    const details = await service.getMonitorDetails("monitor_1");

    expect(details).not.toBeNull();
    expect(details?.monitor.id).toBe("monitor_1");
    expect(details?.windows).toHaveLength(3);
    expect(details?.recentChecks).toHaveLength(2);
    expect(details?.recentIncidents).toHaveLength(1);
    expect(details?.recentNotifications).toHaveLength(1);
  });
});
