import { MonitorState, MonitorTermKind, Prisma } from "@prisma/client";

import { addMonths, formatDateTime } from "../../lib/date-time";
import { normalizeUrl } from "../../lib/url";
import { JsonRule } from "../checks/types";
import { createMonitorSchema, UpdateMonitorSettingsInput, updateMonitorSettingsSchema } from "./monitor.schemas";
import { MonitorRepository, MonitorWithUser } from "./monitor.repository";

export interface MonitorSchedulerPort {
  scheduleMonitor(monitorId: string, intervalMinutes: number): Promise<void>;
  removeMonitorSchedule(monitorId: string): Promise<void>;
  enqueueManualCheck(monitorId: string): Promise<void>;
}

export interface SubscriptionAccessPort {
  getActiveSubscriptionForUser(userId: string): Promise<{ currentPeriodEnd: Date } | null>;
}

export class MonitorService {
  constructor(
    private readonly monitorRepository: MonitorRepository,
    private readonly scheduler: MonitorSchedulerPort,
    private readonly subscriptionAccess: SubscriptionAccessPort,
  ) {}

  async findExistingMonitorByUrl(userId: string, url: string): Promise<MonitorWithUser | null> {
    return this.findExistingMonitorByNormalizedUrl(userId, normalizeUrl(url));
  }

  async createMonitor(input: {
    userId: string;
    name: string;
    url: string;
    termKind?: MonitorTermKind;
    intervalMinutes: number;
    timeoutMs?: number;
    requiredText?: string | null;
    checkSsl?: boolean;
    checkJson?: boolean;
    jsonRules?: JsonRule[] | null;
    endsAt?: Date | null;
    failureThreshold?: number;
    recoveryThreshold?: number;
  }): Promise<MonitorWithUser> {
    const parsed = createMonitorSchema.parse({
      ...input,
      jsonRules: input.jsonRules ?? null,
    });

    const normalizedUrl = normalizeUrl(parsed.url);
    const existingMonitor = await this.findExistingMonitorByNormalizedUrl(parsed.userId, normalizedUrl);

    if (existingMonitor) {
      throw new Error("Монитор для этого URL уже существует.");
    }

    let endsAt = parsed.endsAt ?? null;

    if (parsed.termKind === MonitorTermKind.TRIAL) {
      const latestTrial = await this.monitorRepository.findLatestTrialByNormalizedUrl(parsed.userId, normalizedUrl);

      if (latestTrial) {
        const nextTrialAvailableAt = addMonths(latestTrial.createdAt, 6);

        if (nextTrialAvailableAt > new Date()) {
          throw new Error(
            `Пробный период для этого URL уже использовался. Повторный trial будет доступен после ${formatDateTime(nextTrialAvailableAt, latestTrial.user.timezone)}.`,
          );
        }
      }
    }

    if (parsed.termKind === MonitorTermKind.SUBSCRIPTION) {
      const activeSubscription = await this.subscriptionAccess.getActiveSubscriptionForUser(parsed.userId);

      if (!activeSubscription) {
        throw new Error("Для платного тарифа нужна активная подписка Telegram Stars.");
      }

      endsAt = activeSubscription.currentPeriodEnd;
    }

    const monitor = await this.monitorRepository.createMonitor({
      userId: parsed.userId,
      name: parsed.name,
      url: normalizedUrl,
      normalizedUrl,
      termKind: parsed.termKind,
      intervalMinutes: parsed.intervalMinutes,
      timeoutMs: parsed.timeoutMs,
      requiredText: parsed.requiredText || null,
      checkSsl: parsed.checkSsl,
      checkJson: parsed.checkJson,
      jsonRules: parsed.jsonRules ?? Prisma.JsonNull,
      endsAt,
      failureThreshold: parsed.failureThreshold,
      recoveryThreshold: parsed.recoveryThreshold,
      currentState: MonitorState.UNKNOWN,
      isActive: true,
      billingLocked: false,
      consecutiveFailures: 0,
    });

    await Promise.all([
      this.scheduler.scheduleMonitor(monitor.id, monitor.intervalMinutes),
      this.scheduler.enqueueManualCheck(monitor.id),
    ]);

    return monitor;
  }

  async listUserMonitors(userId: string, filters?: { pausedOnly?: boolean; activeOnly?: boolean }): Promise<MonitorWithUser[]> {
    return this.monitorRepository.listByUser(userId, {
      onlyPaused: filters?.pausedOnly,
      onlyActive: filters?.activeOnly,
    });
  }

  async listActiveMonitorsForScheduler(): Promise<Array<{ monitorId: string; intervalMinutes: number }>> {
    return this.monitorRepository.listActiveMonitorSchedules();
  }

  async getMonitorForUser(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.monitorRepository.findByIdForUser(userId, monitorId);

    if (!monitor) {
      throw new Error("Монитор не найден.");
    }

    return monitor;
  }

  async pauseMonitor(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.getMonitorForUser(userId, monitorId);
    const updatedMonitor = await this.monitorRepository.updateMonitor(monitor.id, {
      isActive: false,
      currentState: MonitorState.PAUSED,
      consecutiveFailures: 0,
    });

    await this.scheduler.removeMonitorSchedule(updatedMonitor.id);

    return updatedMonitor;
  }

  async resumeMonitor(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.getMonitorForUser(userId, monitorId);

    if (monitor.endsAt && monitor.endsAt <= new Date()) {
      throw new Error("Срок мониторинга истек. Продлите подписку или создайте новый монитор.");
    }

    if (monitor.billingLocked) {
      throw new Error("Монитор временно заблокирован по сроку подписки. Продлите доступ и попробуйте снова.");
    }

    const updatedMonitor = await this.monitorRepository.updateMonitor(monitor.id, {
      isActive: true,
      currentState: MonitorState.UNKNOWN,
      consecutiveFailures: 0,
      lastErrorMessage: null,
    });

    await Promise.all([
      this.scheduler.scheduleMonitor(updatedMonitor.id, updatedMonitor.intervalMinutes),
      this.scheduler.enqueueManualCheck(updatedMonitor.id),
    ]);

    return updatedMonitor;
  }

  async removeMonitor(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.getMonitorForUser(userId, monitorId);

    await this.scheduler.removeMonitorSchedule(monitor.id);
    return this.monitorRepository.softDeleteMonitor(monitor.id, new Date());
  }

  async updateMonitorSettings(
    userId: string,
    monitorId: string,
    input: UpdateMonitorSettingsInput,
  ): Promise<MonitorWithUser> {
    const monitor = await this.getMonitorForUser(userId, monitorId);
    const parsed = updateMonitorSettingsSchema.parse(input);

    const updatedMonitor = await this.monitorRepository.updateMonitor(monitor.id, {
      intervalMinutes: parsed.intervalMinutes,
      timeoutMs: parsed.timeoutMs,
      requiredText: parsed.requiredText === undefined ? undefined : parsed.requiredText || null,
      checkSsl: parsed.checkSsl,
      checkJson: parsed.checkJson ?? (parsed.jsonRules !== undefined ? parsed.jsonRules !== null : undefined),
      jsonRules: parsed.jsonRules === undefined ? undefined : parsed.jsonRules ?? Prisma.JsonNull,
      endsAt: parsed.endsAt,
      failureThreshold: parsed.failureThreshold,
    });

    if (updatedMonitor.isActive && !updatedMonitor.billingLocked && parsed.intervalMinutes) {
      await this.scheduler.scheduleMonitor(updatedMonitor.id, updatedMonitor.intervalMinutes);
    }

    return updatedMonitor;
  }

  private async findExistingMonitorByNormalizedUrl(
    userId: string,
    normalizedUrl: string,
  ): Promise<MonitorWithUser | null> {
    return this.monitorRepository.findExistingByNormalizedUrl(userId, normalizedUrl);
  }
}
