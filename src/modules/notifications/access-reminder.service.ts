import { AccessReminderKind, PrismaClient, UserSubscriptionStatus } from "@prisma/client";

import { ACCESS_REMINDER_THRESHOLDS } from "../../config/constants";
import { daysUntil } from "../../lib/date-time";
import {
  buildSubscriptionEndingSoonMessage,
  buildTrialEndingSoonMessage,
} from "./message-builder";
import { NotificationService } from "./notification.service";

export class AccessReminderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notificationService: NotificationService,
  ) {}

  async run(now = new Date()): Promise<void> {
    await Promise.all([
      this.sendTrialEndingReminders(now),
      this.sendSubscriptionEndingReminders(now),
    ]);
  }

  private async sendTrialEndingReminders(now: Date): Promise<void> {
    const trialMonitors = await this.prisma.monitor.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        termKind: "TRIAL",
        endsAt: {
          gt: now,
        },
      },
      include: {
        user: true,
      },
    });

    for (const monitor of trialMonitors) {
      const daysLeft = daysUntil(monitor.endsAt!, now);

      if (!ACCESS_REMINDER_THRESHOLDS.includes(daysLeft as (typeof ACCESS_REMINDER_THRESHOLDS)[number])) {
        continue;
      }

      const existingLog = await this.prisma.accessReminderLog.findFirst({
        where: {
          kind: AccessReminderKind.TRIAL,
          userId: monitor.userId,
          monitorId: monitor.id,
          thresholdDays: daysLeft,
          targetEndsAt: monitor.endsAt!,
        },
      });

      if (existingLog) {
        continue;
      }

      await this.notificationService.sendPlainMessage(
        monitor.user.telegramId,
        buildTrialEndingSoonMessage(monitor, daysLeft),
      );

      await this.prisma.accessReminderLog.create({
        data: {
          kind: AccessReminderKind.TRIAL,
          userId: monitor.userId,
          monitorId: monitor.id,
          thresholdDays: daysLeft,
          targetEndsAt: monitor.endsAt!,
        },
      });
    }
  }

  private async sendSubscriptionEndingReminders(now: Date): Promise<void> {
    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        status: UserSubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gt: now,
        },
      },
      include: {
        user: true,
      },
    });

    for (const subscription of subscriptions) {
      const daysLeft = daysUntil(subscription.currentPeriodEnd, now);

      if (!ACCESS_REMINDER_THRESHOLDS.includes(daysLeft as (typeof ACCESS_REMINDER_THRESHOLDS)[number])) {
        continue;
      }

      const existingLog = await this.prisma.accessReminderLog.findFirst({
        where: {
          kind: AccessReminderKind.SUBSCRIPTION,
          userId: subscription.userId,
          userSubscriptionId: subscription.id,
          thresholdDays: daysLeft,
          targetEndsAt: subscription.currentPeriodEnd,
        },
      });

      if (existingLog) {
        continue;
      }

      await this.notificationService.sendPlainMessage(
        subscription.user.telegramId,
        buildSubscriptionEndingSoonMessage({
          planLabel: "Подписка 30 дней",
          currentPeriodEnd: subscription.currentPeriodEnd,
          daysLeft,
          timeZone: subscription.user.timezone,
        }),
      );

      await this.prisma.accessReminderLog.create({
        data: {
          kind: AccessReminderKind.SUBSCRIPTION,
          userId: subscription.userId,
          userSubscriptionId: subscription.id,
          thresholdDays: daysLeft,
          targetEndsAt: subscription.currentPeriodEnd,
        },
      });
    }
  }
}
