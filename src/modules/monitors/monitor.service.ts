import { MonitorState, MonitorTermKind, Prisma } from "@prisma/client";

import { addMonths, formatDateTime } from "../../lib/date-time";
import { normalizeUrl } from "../../lib/url";
import { JsonRule, MonitorCheckExecutionResult } from "../checks/types";
import { createMonitorSchema, UpdateMonitorSettingsInput, updateMonitorSettingsSchema } from "./monitor.schemas";
import { MonitorRepository, MonitorWithUser } from "./monitor.repository";

export interface MonitorSchedulerPort {
  scheduleMonitor(monitorId: string, intervalMinutes: number): Promise<void>;
  removeMonitorSchedule(monitorId: string): Promise<void>;
  enqueueManualCheck(monitorId: string): Promise<void>;
}

export class MonitorService {
  constructor(
    private readonly monitorRepository: MonitorRepository,
    private readonly scheduler: MonitorSchedulerPort,
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
      throw new Error("\u041c\u043e\u043d\u0438\u0442\u043e\u0440 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e URL \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
    }

    if (parsed.termKind === MonitorTermKind.TRIAL) {
      const latestTrial = await this.monitorRepository.findLatestTrialByNormalizedUrl(parsed.userId, normalizedUrl);

      if (latestTrial) {
        const nextTrialAvailableAt = addMonths(latestTrial.createdAt, 6);

        if (nextTrialAvailableAt > new Date()) {
          throw new Error(
            `\u041f\u0440\u043e\u0431\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e URL \u0443\u0436\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0441\u044f. \u041f\u043e\u0432\u0442\u043e\u0440\u043d\u044b\u0439 trial \u0431\u0443\u0434\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u043f\u043e\u0441\u043b\u0435 ${formatDateTime(nextTrialAvailableAt, latestTrial.user.timezone)}.`,
          );
        }
      }
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
      endsAt: parsed.endsAt ?? null,
      failureThreshold: parsed.failureThreshold,
      recoveryThreshold: parsed.recoveryThreshold,
      currentState: MonitorState.UNKNOWN,
      isActive: true,
      consecutiveFailures: 0,
    });

    await this.scheduler.scheduleMonitor(monitor.id, monitor.intervalMinutes);
    await this.scheduler.enqueueManualCheck(monitor.id);

    return monitor;
  }

  async listUserMonitors(userId: string, filters?: { pausedOnly?: boolean; activeOnly?: boolean }): Promise<MonitorWithUser[]> {
    return this.monitorRepository.listByUser(userId, {
      onlyPaused: filters?.pausedOnly,
      onlyActive: filters?.activeOnly,
    });
  }

  async listActiveMonitorsForScheduler(): Promise<Array<{ id: string; intervalMinutes: number }>> {
    const monitors = await this.monitorRepository.listActiveMonitors();
    return monitors.map((monitor) => ({
      id: monitor.id,
      intervalMinutes: monitor.intervalMinutes,
    }));
  }

  async getMonitorForUser(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.monitorRepository.findByIdForUser(userId, monitorId);

    if (!monitor) {
      throw new Error("\u041c\u043e\u043d\u0438\u0442\u043e\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.");
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

    await this.scheduler.removeMonitorSchedule(monitor.id);

    return updatedMonitor;
  }

  async resumeMonitor(userId: string, monitorId: string): Promise<MonitorWithUser> {
    const monitor = await this.getMonitorForUser(userId, monitorId);

    const updatedMonitor = await this.monitorRepository.updateMonitor(monitor.id, {
      isActive: true,
      currentState: MonitorState.UNKNOWN,
      consecutiveFailures: 0,
    });

    await this.scheduler.scheduleMonitor(updatedMonitor.id, updatedMonitor.intervalMinutes);
    await this.scheduler.enqueueManualCheck(updatedMonitor.id);

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

    if (updatedMonitor.isActive && parsed.intervalMinutes) {
      await this.scheduler.scheduleMonitor(updatedMonitor.id, updatedMonitor.intervalMinutes);
    }

    return updatedMonitor;
  }

  formatManualCheckResult(result: MonitorCheckExecutionResult): string {
    return [
      `\u0421\u0442\u0430\u0442\u0443\u0441: ${result.statusCode ?? "n/a"}`,
      `\u0412\u0440\u0435\u043c\u044f \u043e\u0442\u0432\u0435\u0442\u0430: ${result.responseTimeMs ?? "n/a"} ms`,
      `\u0422\u0435\u043a\u0441\u0442 \u043d\u0430\u0439\u0434\u0435\u043d: ${
        result.contentMatched === undefined ? "\u043d\u0435 \u0437\u0430\u0434\u0430\u043d" : result.contentMatched ? "\u0434\u0430" : "\u043d\u0435\u0442"
      }`,
      `JSON \u0432\u0430\u043b\u0438\u0434\u0435\u043d: ${
        result.jsonMatched === undefined ? "\u043d\u0435 \u0437\u0430\u0434\u0430\u043d" : result.jsonMatched ? "\u0434\u0430" : "\u043d\u0435\u0442"
      }`,
    ].join("\n");
  }

  private async findExistingMonitorByNormalizedUrl(
    userId: string,
    normalizedUrl: string,
  ): Promise<MonitorWithUser | null> {
    return this.monitorRepository.findExistingByNormalizedUrl(userId, normalizedUrl);
  }
}
