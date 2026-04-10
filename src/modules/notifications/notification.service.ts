import { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { Telegram } from "telegraf";

import { logger } from "../../lib/logger";
import { MonitorCheckExecutionResult } from "../checks/types";
import { MonitorWithUser } from "../monitors/monitor.repository";
import {
  buildDailySummaryMessage,
  buildDownAlertMessage,
  buildManualCheckMessage,
  buildRecoveryAlertMessage,
  buildSslExpiringAlertMessage,
  buildWeeklySummaryMessage,
} from "./message-builder";

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly telegram: Telegram,
  ) {}

  private async sendAndLog(
    monitor: MonitorWithUser,
    type: NotificationType,
    text: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.telegram.sendMessage(monitor.user.telegramId, text);

    await this.prisma.notificationLog.create({
      data: {
        monitorId: monitor.id,
        type,
        payload,
      },
    });
  }

  async sendPlainMessage(chatId: string, text: string): Promise<void> {
    await this.telegram.sendMessage(chatId, text);
  }

  async sendDownAlert(
    monitor: MonitorWithUser,
    input: {
      reason: string;
      checkedAt: Date;
      consecutiveFailures: number;
    },
  ): Promise<void> {
    await this.sendAndLog(
      monitor,
      NotificationType.DOWN,
      buildDownAlertMessage(monitor, input),
      {
        reason: input.reason,
        checkedAt: input.checkedAt.toISOString(),
        consecutiveFailures: input.consecutiveFailures,
      },
    );
  }

  async sendRecoveryAlert(
    monitor: MonitorWithUser,
    input: {
      statusCode?: number;
      recoveredAt: Date;
      durationSeconds: number;
    },
  ): Promise<void> {
    await this.sendAndLog(
      monitor,
      NotificationType.RECOVERED,
      buildRecoveryAlertMessage(monitor, input),
      {
        statusCode: input.statusCode ?? null,
        recoveredAt: input.recoveredAt.toISOString(),
        durationSeconds: input.durationSeconds,
      },
    );
  }

  async sendSslExpiringAlert(
    monitor: MonitorWithUser,
    input: {
      expiresAt: Date;
      daysLeft: number;
      thresholdDays: number;
    },
  ): Promise<void> {
    await this.sendAndLog(
      monitor,
      NotificationType.SSL_EXPIRING,
      buildSslExpiringAlertMessage(monitor, input),
      {
        expiresAt: input.expiresAt.toISOString(),
        daysLeft: input.daysLeft,
        thresholdDays: input.thresholdDays,
      },
    );
  }

  async sendManualCheckResult(
    monitor: MonitorWithUser,
    result: MonitorCheckExecutionResult,
  ): Promise<void> {
    await this.sendAndLog(
      monitor,
      NotificationType.MANUAL_CHECK,
      buildManualCheckMessage(monitor, result),
      {
        success: result.success,
        statusCode: result.statusCode ?? null,
        responseTimeMs: result.responseTimeMs ?? null,
        errorMessage: result.errorMessage ?? null,
        contentMatched: result.contentMatched ?? null,
        jsonMatched: result.jsonMatched ?? null,
        checkedAt: result.checkedAt.toISOString(),
      },
    );
  }

  async sendDailySummary(
    chatId: string,
    input: {
      monitorCount: number;
      failedChecks: number;
      incidentsOpened: number;
      averageUptimePercent: number;
    },
  ): Promise<void> {
    await this.sendPlainMessage(chatId, buildDailySummaryMessage(input));
  }

  async sendWeeklySummary(
    chatId: string,
    input: {
      monitorCount: number;
      incidentsOpened: number;
      averageUptimePercent: number;
      slowestMonitors: Array<{ name: string; averageResponseTimeMs: number }>;
    },
  ): Promise<void> {
    try {
      await this.sendPlainMessage(chatId, buildWeeklySummaryMessage(input));
    } catch (error) {
      logger.error({ err: error, chatId }, "Failed to send weekly summary");
      throw error;
    }
  }
}
