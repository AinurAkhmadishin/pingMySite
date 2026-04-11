import { env } from "../../config/env";
import { getMoscowTimeMinutes, getStartOfMoscowDay } from "../../lib/date-time";
import { logger } from "../../lib/logger";
import { NotificationService } from "../notifications/notification.service";
import { UserService } from "../users/user.service";
import { ReportService } from "./report.service";

export class SummaryService {
  constructor(
    private readonly userService: UserService,
    private readonly reportService: ReportService,
    private readonly notificationService: NotificationService,
  ) {}

  async run(frequency: "daily" | "weekly", now = new Date()): Promise<void> {
    if (frequency === "daily" && !env.ENABLE_DAILY_SUMMARIES) {
      return;
    }

    if (frequency === "weekly" && !env.ENABLE_WEEKLY_SUMMARIES) {
      return;
    }

    if (frequency === "daily") {
      await this.runDailyDispatch(now);
      return;
    }

    const users = await this.userService.listUsersForSummary("weekly");

    for (const user of users) {
      try {
        const summary = await this.reportService.getUserSummary(user.id, "weekly");

        await this.notificationService.sendWeeklySummary(user.telegramId, {
          monitorCount: summary.monitorCount,
          incidentsOpened: summary.incidentsOpened,
          averageUptimePercent: summary.averageUptimePercent,
          slowestMonitors: summary.slowestMonitors,
        });
      } catch (error) {
        logger.error({ err: error, userId: user.id, frequency }, "Failed to send summary");
      }
    }
  }

  private async runDailyDispatch(now: Date): Promise<void> {
    const currentMoscowMinutes = getMoscowTimeMinutes(now);
    const dayStart = getStartOfMoscowDay(now);
    const users = await this.userService.listUsersDueForDailySummary(currentMoscowMinutes, dayStart);

    for (const user of users) {
      try {
        const summary = await this.reportService.getUserDailyStatusSummary(user.id);

        if (!summary) {
          continue;
        }

        await this.notificationService.sendDailySummary(
          user.telegramId,
          {
            activeMonitorCount: summary.activeMonitorCount,
            pausedMonitorCount: summary.pausedMonitorCount,
            upCount: summary.upCount,
            downCount: summary.downCount,
            unknownCount: summary.unknownCount,
            problematicMonitors: summary.problematicMonitors,
          },
          user.timezone,
        );
        await this.userService.updateDailySummarySettings(user.id, {
          lastSentAt: now,
        });
      } catch (error) {
        logger.error({ err: error, userId: user.id, frequency: "daily" }, "Failed to send summary");
      }
    }
  }
}
