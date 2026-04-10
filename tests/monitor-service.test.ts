import { MonitorState, MonitorTermKind } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitorWithUser } from "../src/modules/monitors/monitor.repository";
import { MonitorService } from "../src/modules/monitors/monitor.service";

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
    billingLocked: false,
    deletedAt: null,
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
    ...overrides,
  } as MonitorWithUser;
}

function createService() {
  const repository = {
    findExistingByNormalizedUrl: vi.fn().mockResolvedValue(null),
    findLatestTrialByNormalizedUrl: vi.fn().mockResolvedValue(null),
    createMonitor: vi.fn().mockResolvedValue(createMonitor()),
    findByIdForUser: vi.fn(),
    updateMonitor: vi.fn(),
  };
  const scheduler = {
    scheduleMonitor: vi.fn().mockResolvedValue(undefined),
    removeMonitorSchedule: vi.fn().mockResolvedValue(undefined),
    enqueueManualCheck: vi.fn().mockResolvedValue(undefined),
  };
  const subscriptionAccess = {
    getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
  };

  return {
    repository,
    scheduler,
    subscriptionAccess,
    service: new MonitorService(repository as never, scheduler, subscriptionAccess),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("monitor service", () => {
  it("schedules an immediate check after trial monitor creation", async () => {
    const { repository, scheduler, service } = createService();

    await service.createMonitor({
      userId: "user_1",
      name: "Example",
      url: "example.com",
      intervalMinutes: 5,
    });

    expect(repository.createMonitor).toHaveBeenCalledWith(expect.any(Object));
    expect(scheduler.scheduleMonitor).toHaveBeenCalledWith("monitor_1", 5);
    expect(scheduler.enqueueManualCheck).toHaveBeenCalledWith("monitor_1");
  });

  it("passes the monitoring end date to repository on trial creation", async () => {
    const endsAt = new Date("2026-04-10T12:00:00.000Z");
    const { repository, service } = createService();
    repository.createMonitor.mockResolvedValue(createMonitor({ endsAt }));

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

    const { repository, scheduler, service } = createService();
    repository.findLatestTrialByNormalizedUrl.mockResolvedValue(
      createMonitor({
        createdAt: new Date("2026-04-07T10:00:00.000Z"),
      }),
    );

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

  it("creates a paid monitor only with an active subscription and reuses subscription end date", async () => {
    const paidEndsAt = new Date("2026-05-10T12:00:00.000Z");
    const { repository, subscriptionAccess, service } = createService();
    subscriptionAccess.getActiveSubscriptionForUser.mockResolvedValue({
      currentPeriodEnd: paidEndsAt,
    });
    repository.createMonitor.mockResolvedValue(
      createMonitor({
        termKind: MonitorTermKind.SUBSCRIPTION,
        endsAt: paidEndsAt,
      }),
    );

    await service.createMonitor({
      userId: "user_1",
      name: "Paid",
      url: "example.com",
      termKind: MonitorTermKind.SUBSCRIPTION,
      intervalMinutes: 5,
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
    });

    expect(repository.createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        termKind: MonitorTermKind.SUBSCRIPTION,
        endsAt: paidEndsAt,
      }),
    );
  });

  it("blocks a paid monitor when there is no active subscription", async () => {
    const { repository, service } = createService();

    await expect(
      service.createMonitor({
        userId: "user_1",
        name: "Paid",
        url: "example.com",
        termKind: MonitorTermKind.SUBSCRIPTION,
        intervalMinutes: 5,
      }),
    ).rejects.toThrow("активная подписка Telegram Stars");

    expect(repository.createMonitor).not.toHaveBeenCalled();
  });

  it("schedules an immediate check after monitor resume", async () => {
    const { repository, scheduler, service } = createService();
    repository.findByIdForUser.mockResolvedValue(
      createMonitor({
        currentState: MonitorState.PAUSED,
        isActive: false,
      }),
    );
    repository.updateMonitor.mockResolvedValue(
      createMonitor({
        currentState: MonitorState.UNKNOWN,
        isActive: true,
      }),
    );

    await service.resumeMonitor("user_1", "monitor_1");

    expect(repository.updateMonitor).toHaveBeenCalledWith("monitor_1", expect.any(Object));
    expect(scheduler.scheduleMonitor).toHaveBeenCalledWith("monitor_1", 5);
    expect(scheduler.enqueueManualCheck).toHaveBeenCalledWith("monitor_1");
  });

  it("does not resume a billing-locked monitor", async () => {
    const { repository, scheduler, service } = createService();
    repository.findByIdForUser.mockResolvedValue(
      createMonitor({
        currentState: MonitorState.PAUSED,
        isActive: false,
        billingLocked: true,
      }),
    );

    await expect(service.resumeMonitor("user_1", "monitor_1")).rejects.toThrow("временно заблокирован");
    expect(scheduler.scheduleMonitor).not.toHaveBeenCalled();
  });
});
