import { PrismaClient } from "@prisma/client";

import { REPORT_WINDOWS } from "../../config/constants";
import { subtractHours } from "../../lib/date-time";
import { IncidentRepository } from "../incidents/incident.repository";
import { MonitorRepository } from "../monitors/monitor.repository";
import { calculateUptimeStatistics } from "./uptime";

export interface MonitorReportWindow {
  label: string;
  totalChecks: number;
  successfulChecks: number;
  uptimePercent: number;
}

export interface MonitorReport {
  monitorId: string;
  monitorName: string;
  url: string;
  currentState: string;
  endsAt: Date | null;
  averageResponseTimeMs: number | null;
  totalIncidents: number;
  lastIncidentReason?: string;
  lastIncidentStartedAt?: Date;
  openIncident: boolean;
  windows: MonitorReportWindow[];
  recentIncidents: Array<{
    startedAt: Date;
    resolvedAt?: Date | null;
    durationSeconds?: number | null;
    reason: string;
    status: string;
  }>;
}

export class ReportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly monitorRepository: MonitorRepository,
    private readonly incidentRepository: IncidentRepository,
  ) {}

  async getMonitorReport(userId: string, monitorId: string): Promise<MonitorReport | null> {
    const monitor = await this.monitorRepository.findByIdForUser(userId, monitorId);

    if (!monitor) {
      return null;
    }

    const now = new Date();
    const maxWindowHours = Math.max(...REPORT_WINDOWS.map((window) => window.hours));
    const since = subtractHours(now, maxWindowHours);

    const checks = await this.prisma.checkResult.findMany({
      where: {
        monitorId,
        checkedAt: {
          gte: since,
        },
      },
      select: {
        checkedAt: true,
        responseTimeMs: true,
        success: true,
      },
      orderBy: {
        checkedAt: "desc",
      },
    });

    const windows = REPORT_WINDOWS.map((window) => {
      const filteredChecks = checks.filter((check) => check.checkedAt >= subtractHours(now, window.hours));
      const stats = calculateUptimeStatistics(filteredChecks);

      return {
        label: window.key,
        totalChecks: stats.totalChecks,
        successfulChecks: stats.successfulChecks,
        uptimePercent: stats.uptimePercent,
      };
    });

    const aggregateStats = calculateUptimeStatistics(checks);
    const totalIncidents = await this.incidentRepository.countByMonitorId(monitorId);
    const recentIncidents = await this.incidentRepository.findRecentByMonitorId(monitorId, 5);
    const lastIncident = recentIncidents[0];

    return {
      monitorId: monitor.id,
      monitorName: monitor.name,
      url: monitor.url,
      currentState: monitor.currentState,
      endsAt: monitor.endsAt,
      averageResponseTimeMs: aggregateStats.averageResponseTimeMs,
      totalIncidents,
      lastIncidentReason: lastIncident?.reason,
      lastIncidentStartedAt: lastIncident?.startedAt,
      openIncident: recentIncidents.some((incident) => incident.status === "OPEN"),
      windows,
      recentIncidents: recentIncidents.map((incident) => ({
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        durationSeconds: incident.durationSeconds,
        reason: incident.reason,
        status: incident.status,
      })),
    };
  }

  async getUserSummary(userId: string, frequency: "daily" | "weekly"): Promise<{
    monitorCount: number;
    failedChecks: number;
    incidentsOpened: number;
    averageUptimePercent: number;
    slowestMonitors: Array<{ name: string; averageResponseTimeMs: number }>;
  }> {
    const monitors = await this.monitorRepository.listByUser(userId);
    const hours = frequency === "daily" ? 24 : 24 * 7;
    const since = subtractHours(new Date(), hours);
    const monitorIds = monitors.map((monitor) => monitor.id);

    if (monitorIds.length === 0) {
      return {
        monitorCount: 0,
        failedChecks: 0,
        incidentsOpened: 0,
        averageUptimePercent: 100,
        slowestMonitors: [],
      };
    }

    const checks = await this.prisma.checkResult.findMany({
      where: {
        monitorId: {
          in: monitorIds,
        },
        checkedAt: {
          gte: since,
        },
      },
      select: {
        monitorId: true,
        success: true,
        responseTimeMs: true,
        checkedAt: true,
      },
    });

    const incidentsOpened = await this.prisma.incident.count({
      where: {
        monitorId: {
          in: monitorIds,
        },
        startedAt: {
          gte: since,
        },
      },
    });

    const failedChecks = checks.filter((check) => !check.success).length;
    const checksByMonitor = new Map<string, typeof checks>();

    for (const check of checks) {
      const list = checksByMonitor.get(check.monitorId) ?? [];
      list.push(check);
      checksByMonitor.set(check.monitorId, list);
    }

    const perMonitorStats = monitors.map((monitor) => {
      const stats = calculateUptimeStatistics(checksByMonitor.get(monitor.id) ?? []);
      return {
        name: monitor.name,
        uptimePercent: stats.uptimePercent,
        averageResponseTimeMs: stats.averageResponseTimeMs ?? 0,
      };
    });

    const averageUptimePercent =
      perMonitorStats.length > 0
        ? Number(
            (
              perMonitorStats.reduce((sum, monitor) => sum + monitor.uptimePercent, 0) /
              perMonitorStats.length
            ).toFixed(2),
          )
        : 100;

    const slowestMonitors = perMonitorStats
      .filter((monitor) => monitor.averageResponseTimeMs > 0)
      .sort((left, right) => right.averageResponseTimeMs - left.averageResponseTimeMs)
      .slice(0, 3)
      .map((monitor) => ({
        name: monitor.name,
        averageResponseTimeMs: monitor.averageResponseTimeMs,
      }));

    return {
      monitorCount: monitors.length,
      failedChecks,
      incidentsOpened,
      averageUptimePercent,
      slowestMonitors,
    };
  }
}
