import { MonitorState, Prisma } from "@prisma/client";

import { normalizeUrl } from "../../lib/url";
import { MonitorCheckExecutionResult } from "../checks/types";
import { JsonRule } from "../checks/types";
import { createMonitorSchema, UpdateMonitorSettingsInput, updateMonitorSettingsSchema } from "./monitor.schemas";
import { MonitorRepository, MonitorWithUser } from "./monitor.repository";

export interface MonitorSchedulerPort {
  scheduleMonitor(monitorId: string, intervalMinutes: number): Promise<void>;
  removeMonitorSchedule(monitorId: string): Promise<void>;
}

export class MonitorService {
  constructor(
    private readonly monitorRepository: MonitorRepository,
    private readonly scheduler: MonitorSchedulerPort,
  ) {}

  async createMonitor(input: {
    userId: string;
    name: string;
    url: string;
    intervalMinutes: number;
    timeoutMs?: number;
    requiredText?: string | null;
    checkSsl?: boolean;
    checkJson?: boolean;
    jsonRules?: JsonRule[] | null;
    failureThreshold?: number;
    recoveryThreshold?: number;
  }): Promise<MonitorWithUser> {
    const parsed = createMonitorSchema.parse({
      ...input,
      jsonRules: input.jsonRules ?? null,
    });

    const normalizedUrl = normalizeUrl(parsed.url);
    const existingMonitor = await this.monitorRepository.findExistingByNormalizedUrl(parsed.userId, normalizedUrl);

    if (existingMonitor) {
      throw new Error("Монитор для этого URL уже существует.");
    }

    const monitor = await this.monitorRepository.createMonitor({
      userId: parsed.userId,
      name: parsed.name,
      url: normalizedUrl,
      normalizedUrl,
      intervalMinutes: parsed.intervalMinutes,
      timeoutMs: parsed.timeoutMs,
      requiredText: parsed.requiredText || null,
      checkSsl: parsed.checkSsl,
      checkJson: parsed.checkJson,
      jsonRules: parsed.jsonRules ?? Prisma.JsonNull,
      failureThreshold: parsed.failureThreshold,
      recoveryThreshold: parsed.recoveryThreshold,
      currentState: MonitorState.UNKNOWN,
      isActive: true,
      consecutiveFailures: 0,
    });

    await this.scheduler.scheduleMonitor(monitor.id, monitor.intervalMinutes);

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
      failureThreshold: parsed.failureThreshold,
    });

    if (updatedMonitor.isActive && parsed.intervalMinutes) {
      await this.scheduler.scheduleMonitor(updatedMonitor.id, updatedMonitor.intervalMinutes);
    }

    return updatedMonitor;
  }

  formatManualCheckResult(result: MonitorCheckExecutionResult): string {
    return [
      `Статус: ${result.statusCode ?? "n/a"}`,
      `Время ответа: ${result.responseTimeMs ?? "n/a"} ms`,
      `Текст найден: ${result.contentMatched === undefined ? "не задан" : result.contentMatched ? "да" : "нет"}`,
      `JSON валиден: ${result.jsonMatched === undefined ? "не задан" : result.jsonMatched ? "да" : "нет"}`,
    ].join("\n");
  }
}
