import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { UserService } from "../users/user.service";
import { ReportService } from "./report.service";
import { NotificationService } from "../notifications/notification.service";

export class SummaryService {
  constructor(
    private readonly userService: UserService,
    private readonly reportService: ReportService,
    private readonly notificationService: NotificationService,
  ) {}

  async run(frequency: "daily" | "weekly"): Promise<void> {
    if (frequency === "daily" && !env.ENABLE_DAILY_SUMMARIES) {
      return;
    }

    if (frequency === "weekly" && !env.ENABLE_WEEKLY_SUMMARIES) {
      return;
    }

    const users = await this.userService.listUsersForSummary(frequency);

    for (const user of users) {
      try {
        const summary = await this.reportService.getUserSummary(user.id, frequency);

        if (frequency === "daily") {
          await this.notificationService.sendDailySummary(user.telegramId, {
            monitorCount: summary.monitorCount,
            failedChecks: summary.failedChecks,
            incidentsOpened: summary.incidentsOpened,
            averageUptimePercent: summary.averageUptimePercent,
          });
        } else {
          await this.notificationService.sendWeeklySummary(user.telegramId, {
            monitorCount: summary.monitorCount,
            incidentsOpened: summary.incidentsOpened,
            averageUptimePercent: summary.averageUptimePercent,
            slowestMonitors: summary.slowestMonitors,
          });
        }
      } catch (error) {
        logger.error({ err: error, userId: user.id, frequency }, "Failed to send summary");
      }
    }
  }
}
