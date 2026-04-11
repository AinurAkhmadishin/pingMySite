import { describe, expect, it, vi } from "vitest";

import { env } from "../src/config/env";
import { SummaryService } from "../src/modules/reports/summary.service";

describe("summary service", () => {
  it("sends daily summaries only to users due at the current Moscow minute", async () => {
    const now = new Date("2026-04-11T06:00:30.000Z");
    const userService = {
      listUsersDueForDailySummary: vi.fn().mockResolvedValue([
        {
          id: "user_1",
          telegramId: "tg_1",
          timezone: "Europe/Moscow",
        },
      ]),
      listUsersForSummary: vi.fn(),
      updateDailySummarySettings: vi.fn(),
    };
    const reportService = {
      getUserDailyStatusSummary: vi.fn().mockResolvedValue({
        activeMonitorCount: 2,
        pausedMonitorCount: 1,
        upCount: 1,
        downCount: 1,
        unknownCount: 0,
        problematicMonitors: [],
      }),
      getUserSummary: vi.fn(),
    };
    const notificationService = {
      sendDailySummary: vi.fn(),
      sendWeeklySummary: vi.fn(),
    };
    const service = new SummaryService(userService as never, reportService as never, notificationService as never);
    const previousFlag = env.ENABLE_DAILY_SUMMARIES;

    env.ENABLE_DAILY_SUMMARIES = true;
    await service.run("daily", now);
    env.ENABLE_DAILY_SUMMARIES = previousFlag;

    expect(userService.listUsersDueForDailySummary).toHaveBeenCalledWith(540, new Date("2026-04-10T21:00:00.000Z"));
    expect(notificationService.sendDailySummary).toHaveBeenCalledWith(
      "tg_1",
      expect.objectContaining({
        activeMonitorCount: 2,
        downCount: 1,
      }),
      "Europe/Moscow",
    );
    expect(userService.updateDailySummarySettings).toHaveBeenCalledWith("user_1", {
      lastSentAt: now,
    });
  });

  it("skips users without active monitors", async () => {
    const userService = {
      listUsersDueForDailySummary: vi.fn().mockResolvedValue([
        {
          id: "user_1",
          telegramId: "tg_1",
          timezone: "Europe/Moscow",
        },
      ]),
      listUsersForSummary: vi.fn(),
      updateDailySummarySettings: vi.fn(),
    };
    const reportService = {
      getUserDailyStatusSummary: vi.fn().mockResolvedValue(null),
      getUserSummary: vi.fn(),
    };
    const notificationService = {
      sendDailySummary: vi.fn(),
      sendWeeklySummary: vi.fn(),
    };
    const service = new SummaryService(userService as never, reportService as never, notificationService as never);
    const previousFlag = env.ENABLE_DAILY_SUMMARIES;

    env.ENABLE_DAILY_SUMMARIES = true;
    await service.run("daily", new Date("2026-04-11T06:00:30.000Z"));
    env.ENABLE_DAILY_SUMMARIES = previousFlag;

    expect(notificationService.sendDailySummary).not.toHaveBeenCalled();
    expect(userService.updateDailySummarySettings).not.toHaveBeenCalled();
  });
});
