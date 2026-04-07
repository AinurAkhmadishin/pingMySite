import { MonitorState, MonitorTermKind } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitorService } from "../src/modules/monitors/monitor.service";
import { MonitorWithUser } from "../src/modules/monitors/monitor.repository";

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
    currentState: MonitorState.UNKNOWN,
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
    ...overrides,
  } as MonitorWithUser;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("monitor service", () => {
  it("schedules an immediate check after monitor creation", async () => {
    const repository = {
      findExistingByNormalizedUrl: vi.fn().mockResolvedValue(null),
      findLatestTrialByNormalizedUrl: vi.fn().mockResolvedValue(null),
      createMonitor: vi.fn().mockResolvedValue(createMonitor()),
    };
    const scheduler = {
      scheduleMonitor: vi.fn().mockResolvedValue(undefined),
      removeMonitorSchedule: vi.fn().mockResolvedValue(undefined),
      enqueueManualCheck: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MonitorService(repository as never, scheduler);

    await service.createMonitor({
      userId: "user_1",
      name: "Example",
      url: "example.com",
      intervalMinutes: 5,
    });

    expect(scheduler.scheduleMonitor).toHaveBeenCalledWith("monitor_1", 5);
    expect(scheduler.enqueueManualCheck).toHaveBeenCalledWith("monitor_1");
  });

  it("passes the monitoring end date to repository on creation", async () => {
    const endsAt = new Date("2026-04-10T12:00:00.000Z");
    const repository = {
      findExistingByNormalizedUrl: vi.fn().mockResolvedValue(null),
      findLatestTrialByNormalizedUrl: vi.fn().mockResolvedValue(null),
      createMonitor: vi.fn().mockResolvedValue(createMonitor({ endsAt })),
    };
    const scheduler = {
      scheduleMonitor: vi.fn().mockResolvedValue(undefined),
      removeMonitorSchedule: vi.fn().mockResolvedValue(undefined),
      enqueueManualCheck: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MonitorService(repository as never, scheduler);

    await service.createMonitor({
      userId: "user_1",
      name: "Example",
      url: "example.com",
      intervalMinutes: 5,
      endsAt,
    });

    expect(repository.createMonitor).toHaveBeenCalledWith(expect.objectContaining({ endsAt }));
  });

  it("blocks a repeated trial for the same url within 6 months from the first trial start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

    const previousTrial = createMonitor({
      createdAt: new Date("2026-04-07T10:00:00.000Z"),
    });
    const repository = {
      findExistingByNormalizedUrl: vi.fn().mockResolvedValue(null),
      findLatestTrialByNormalizedUrl: vi.fn().mockResolvedValue(previousTrial),
      createMonitor: vi.fn(),
    };
    const scheduler = {
      scheduleMonitor: vi.fn().mockResolvedValue(undefined),
      removeMonitorSchedule: vi.fn().mockResolvedValue(undefined),
      enqueueManualCheck: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MonitorService(repository as never, scheduler);

    await expect(
      service.createMonitor({
        userId: "user_1",
        name: "Example",
        url: "example.com",
        termKind: MonitorTermKind.TRIAL,
        intervalMinutes: 5,
      }),
    ).rejects.toThrow("Повторный trial будет доступен после");

    expect(repository.createMonitor).not.toHaveBeenCalled();
    expect(scheduler.scheduleMonitor).not.toHaveBeenCalled();
  });

  it("schedules an immediate check after monitor resume", async () => {
    const pausedMonitor = createMonitor({
      currentState: MonitorState.PAUSED,
      isActive: false,
    });
    const resumedMonitor = createMonitor({
      currentState: MonitorState.UNKNOWN,
      isActive: true,
    });
    const repository = {
      findByIdForUser: vi.fn().mockResolvedValue(pausedMonitor),
      updateMonitor: vi.fn().mockResolvedValue(resumedMonitor),
    };
    const scheduler = {
      scheduleMonitor: vi.fn().mockResolvedValue(undefined),
      removeMonitorSchedule: vi.fn().mockResolvedValue(undefined),
      enqueueManualCheck: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MonitorService(repository as never, scheduler);

    await service.resumeMonitor("user_1", "monitor_1");

    expect(scheduler.scheduleMonitor).toHaveBeenCalledWith("monitor_1", 5);
    expect(scheduler.enqueueManualCheck).toHaveBeenCalledWith("monitor_1");
  });
});
