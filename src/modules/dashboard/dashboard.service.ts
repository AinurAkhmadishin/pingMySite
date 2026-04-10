import { FunnelSessionKind, IncidentStatus, MonitorState, Prisma, PrismaClient } from "@prisma/client";

import { REPORT_WINDOWS } from "../../config/constants";
import { subtractHours } from "../../lib/date-time";
import { buildFunnelAnalytics, DashboardFunnelAnalytics } from "./funnel-analytics";
import { MonitorHealthService, StuckUnknownMonitorSummary } from "../monitors/monitor-health.service";
import { calculateUptimeStatistics } from "../reports/uptime";
import { WorkerHealthService, WorkerHeartbeatStatus } from "../system/worker-health.service";

const DEFAULT_MONITOR_DETAILS_LIMIT = 20;
const DEFAULT_INCIDENT_DETAILS_LIMIT = 10;
const DEFAULT_NOTIFICATION_DETAILS_LIMIT = 10;

const STATE_PRIORITY: Record<MonitorState, number> = {
  DOWN: 0,
  UNKNOWN: 1,
  PAUSED: 2,
  UP: 3,
};

type DashboardUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  timezone: string;
};

export interface DashboardWindowStat {
  label: string;
  totalChecks: number;
  successfulChecks: number;
  uptimePercent: number;
}

export interface DashboardMonitorListItem {
  id: string;
  name: string;
  url: string;
  currentState: MonitorState;
  isActive: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  consecutiveFailures: number;
  failureThreshold: number;
  recoveryThreshold: number;
  lastCheckedAt: Date | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
  lastErrorMessage: string | null;
  requiredText: string | null;
  checkSsl: boolean;
  checkJson: boolean;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: DashboardUser;
  probes: DashboardProbeSummary[];
  uptimePercent24h: number;
  totalChecks24h: number;
  successfulChecks24h: number;
  averageResponseTimeMs24h: number | null;
  openIncident: boolean;
  openIncidentStartedAt: Date | null;
  totalIncidents: number;
}

export interface DashboardProbeSummary {
  monitorProbeId: string;
  probeId: string;
  key: string;
  name: string;
  regionCode: string;
  currentState: MonitorState;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
  lastErrorMessage: string | null;
}

export interface DashboardRecentIncident {
  id: string;
  monitorId: string;
  monitorProbeId: string | null;
  probeId: string | null;
  probeName: string | null;
  probeRegionCode: string | null;
  monitorName: string;
  monitorUrl: string;
  reason: string;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  durationSeconds: number | null;
  user: DashboardUser;
}

export interface DashboardRecentNotification {
  id: string;
  type: string;
  sentAt: Date;
  payload: Prisma.JsonValue;
}

export interface DashboardMonitorDetails {
  monitor: DashboardMonitorListItem;
  windows: DashboardWindowStat[];
  recentChecks: Array<{
    id: string;
    monitorProbeId: string | null;
    probeId: string | null;
    probeName: string | null;
    probeRegionCode: string | null;
    checkedAt: Date;
    success: boolean;
    statusCode: number | null;
    responseTimeMs: number | null;
    errorMessage: string | null;
    contentMatched: boolean | null;
    jsonMatched: boolean | null;
  }>;
  recentIncidents: DashboardRecentIncident[];
  recentNotifications: DashboardRecentNotification[];
}

export interface DashboardOverview {
  generatedAt: Date;
  totals: {
    users: number;
    monitors: number;
    activeMonitors: number;
    downMonitors: number;
    pausedMonitors: number;
    unknownMonitors: number;
    openIncidents: number;
    checksLast24h: number;
    failedChecksLast24h: number;
    averageUptimePercent24h: number;
  };
  worker: WorkerHeartbeatStatus;
  stuckUnknown: StuckUnknownMonitorSummary;
  slowestMonitors: Array<{
    monitorId: string;
    monitorName: string;
    averageResponseTimeMs: number;
    currentState: MonitorState;
    user: DashboardUser;
  }>;
  recentIncidents: DashboardRecentIncident[];
}

export type { DashboardFunnelAnalytics };

type DashboardMonitorQueryRow = {
  id: string;
  name: string;
  url: string;
  currentState: MonitorState;
  isActive: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  consecutiveFailures: number;
  failureThreshold: number;
  recoveryThreshold: number;
  lastCheckedAt: Date | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
  lastErrorMessage: string | null;
  requiredText: string | null;
  checkSsl: boolean;
  checkJson: boolean;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: DashboardUser;
  incidents: Array<{
    id: string;
    startedAt: Date;
  }>;
  _count: {
    incidents: number;
  };
};

function buildUserSummary(user: DashboardUser): DashboardUser {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    timezone: user.timezone,
  };
}

function buildMonitorWhereInput(filters?: {
  search?: string;
  state?: MonitorState | "ALL";
}): Prisma.MonitorWhereInput {
  const search = filters?.search?.trim();

  return {
    deletedAt: null,
    ...(filters?.state && filters.state !== "ALL" ? { currentState: filters.state } : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              url: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              user: {
                username: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                telegramId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  };
}

function groupChecksByMonitor(
  checks: Array<{
    monitorId: string;
    success: boolean;
    responseTimeMs: number | null;
    checkedAt: Date;
  }>,
): Map<string, typeof checks> {
  const grouped = new Map<string, typeof checks>();

  for (const check of checks) {
    const list = grouped.get(check.monitorId) ?? [];
    list.push(check);
    grouped.set(check.monitorId, list);
  }

  return grouped;
}

function sortMonitors(left: DashboardMonitorListItem, right: DashboardMonitorListItem): number {
  const stateDiff = STATE_PRIORITY[left.currentState] - STATE_PRIORITY[right.currentState];

  if (stateDiff !== 0) {
    return stateDiff;
  }

  if (left.openIncident !== right.openIncident) {
    return left.openIncident ? -1 : 1;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function buildProbeSummaries(): DashboardProbeSummary[] {
  return [];
}

function mapIncident(incident: {
  id: string;
  monitorId: string;
  reason: string;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  durationSeconds: number | null;
  monitor: {
    name: string;
    url: string;
    user: DashboardUser;
  };
}): DashboardRecentIncident {
  return {
    id: incident.id,
    monitorId: incident.monitorId,
    monitorProbeId: null,
    probeId: null,
    probeName: null,
    probeRegionCode: null,
    monitorName: incident.monitor.name,
    monitorUrl: incident.monitor.url,
    reason: incident.reason,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    durationSeconds: incident.durationSeconds,
    user: buildUserSummary(incident.monitor.user),
  };
}

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly workerHealthService: WorkerHealthService,
    private readonly monitorHealthService: MonitorHealthService,
  ) {}

  async getOverview(now: Date = new Date()): Promise<DashboardOverview> {
    const since24h = subtractHours(now, 24);

    const [users, monitors, openIncidents, checks24h, recentIncidents, worker, stuckUnknown] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.monitor.findMany({
        where: {
          deletedAt: null,
        },
        include: {
          user: true,
        },
      }),
      this.prisma.incident.count({
        where: {
          status: IncidentStatus.OPEN,
        },
      }),
      this.prisma.checkResult.findMany({
        where: {
          checkedAt: {
            gte: since24h,
          },
        },
        select: {
          monitorId: true,
          success: true,
          responseTimeMs: true,
          checkedAt: true,
        },
      }),
      this.prisma.incident.findMany({
        orderBy: {
          startedAt: "desc",
        },
        take: 6,
        include: {
          monitor: {
            include: {
              user: true,
            },
          },
        },
      }),
      this.workerHealthService.getWorkerStatus(now),
      this.monitorHealthService.getStuckUnknownSummary(now, 5),
    ]);

    const checksByMonitor = groupChecksByMonitor(checks24h);
    const failedChecksLast24h = checks24h.filter((check) => !check.success).length;
    const uptimeStats = calculateUptimeStatistics(checks24h);

    const slowestMonitors = monitors
      .map((monitor) => {
        const stats = calculateUptimeStatistics(checksByMonitor.get(monitor.id) ?? []);

        return {
          monitorId: monitor.id,
          monitorName: monitor.name,
          averageResponseTimeMs: stats.averageResponseTimeMs ?? 0,
          currentState: monitor.currentState,
          user: buildUserSummary(monitor.user),
        };
      })
      .filter((monitor) => monitor.averageResponseTimeMs > 0)
      .sort((left, right) => right.averageResponseTimeMs - left.averageResponseTimeMs)
      .slice(0, 5);

    return {
      generatedAt: now,
      totals: {
        users,
        monitors: monitors.length,
        activeMonitors: monitors.filter((monitor) => monitor.isActive).length,
        downMonitors: monitors.filter((monitor) => monitor.currentState === MonitorState.DOWN).length,
        pausedMonitors: monitors.filter((monitor) => monitor.currentState === MonitorState.PAUSED).length,
        unknownMonitors: monitors.filter((monitor) => monitor.currentState === MonitorState.UNKNOWN).length,
        openIncidents,
        checksLast24h: checks24h.length,
        failedChecksLast24h,
        averageUptimePercent24h: uptimeStats.uptimePercent,
      },
      worker,
      stuckUnknown,
      slowestMonitors,
      recentIncidents: recentIncidents.map(mapIncident),
    };
  }

  async getFunnelAnalytics(windowDays = 30, now: Date = new Date()): Promise<DashboardFunnelAnalytics> {
    const safeWindowDays = Math.min(Math.max(Math.trunc(windowDays) || 30, 1), 90);
    const since = subtractHours(now, safeWindowDays * 24);

    const sessions = await this.prisma.funnelSession.findMany({
      where: {
        kind: FunnelSessionKind.ADD_MONITOR,
        startedAt: {
          gte: since,
        },
      },
      orderBy: {
        lastEventAt: "desc",
      },
      include: {
        user: true,
        events: {
          select: {
            stepKey: true,
            stepLabel: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        checkouts: {
          select: {
            status: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return buildFunnelAnalytics(
      sessions.map((session) => ({
        id: session.id,
        status: session.status,
        currentStepKey: session.currentStepKey,
        currentStepLabel: session.currentStepLabel,
        startedAt: session.startedAt,
        lastEventAt: session.lastEventAt,
        completedAt: session.completedAt,
        lastEventPayload: session.lastEventPayload,
        user: buildUserSummary(session.user),
        events: session.events,
        checkouts: session.checkouts,
      })),
      now,
      safeWindowDays,
    );
  }

  async listMonitors(filters?: {
    search?: string;
    state?: MonitorState | "ALL";
  }): Promise<DashboardMonitorListItem[]> {
    const now = new Date();
    const since24h = subtractHours(now, 24);

    const monitors = (await this.prisma.monitor.findMany({
      where: buildMonitorWhereInput(filters),
      include: {
        user: true,
        incidents: {
          where: {
            status: IncidentStatus.OPEN,
          },
          select: {
            id: true,
            startedAt: true,
          },
          take: 1,
          orderBy: {
            startedAt: "desc",
          },
        },
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })) as DashboardMonitorQueryRow[];

    const monitorIds = monitors.map((monitor) => monitor.id);

    const checks24h =
      monitorIds.length === 0
        ? []
        : await this.prisma.checkResult.findMany({
            where: {
              monitorId: {
                in: monitorIds,
              },
              checkedAt: {
                gte: since24h,
              },
            },
            select: {
              monitorId: true,
              success: true,
              responseTimeMs: true,
              checkedAt: true,
            },
          });

    const checksByMonitor = groupChecksByMonitor(checks24h);

    return monitors
      .map((monitor) => {
        const stats = calculateUptimeStatistics(checksByMonitor.get(monitor.id) ?? []);
        const openIncident = monitor.incidents[0] ?? null;

        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          currentState: monitor.currentState,
          isActive: monitor.isActive,
          intervalMinutes: monitor.intervalMinutes,
          timeoutMs: monitor.timeoutMs,
          consecutiveFailures: monitor.consecutiveFailures,
          failureThreshold: monitor.failureThreshold,
          recoveryThreshold: monitor.recoveryThreshold,
          lastCheckedAt: monitor.lastCheckedAt,
          lastStatusCode: monitor.lastStatusCode,
          lastResponseTimeMs: monitor.lastResponseTimeMs,
          lastErrorMessage: monitor.lastErrorMessage,
          requiredText: monitor.requiredText,
          checkSsl: monitor.checkSsl,
          checkJson: monitor.checkJson,
          endsAt: monitor.endsAt,
          createdAt: monitor.createdAt,
          updatedAt: monitor.updatedAt,
          user: buildUserSummary(monitor.user),
          probes: buildProbeSummaries(),
          uptimePercent24h: stats.uptimePercent,
          totalChecks24h: stats.totalChecks,
          successfulChecks24h: stats.successfulChecks,
          averageResponseTimeMs24h: stats.averageResponseTimeMs,
          openIncident: openIncident !== null,
          openIncidentStartedAt: openIncident?.startedAt ?? null,
          totalIncidents: monitor._count.incidents,
        } satisfies DashboardMonitorListItem;
      })
      .sort(sortMonitors);
  }

  async getMonitorDetails(monitorId: string): Promise<DashboardMonitorDetails | null> {
    const monitor = await this.prisma.monitor.findFirst({
      where: {
        id: monitorId,
        deletedAt: null,
      },
      include: {
        user: true,
        incidents: {
          where: {
            status: IncidentStatus.OPEN,
          },
          select: {
            id: true,
            startedAt: true,
          },
          take: 1,
          orderBy: {
            startedAt: "desc",
          },
        },
        _count: {
          select: {
            incidents: true,
          },
        },
      },
    });

    if (!monitor) {
      return null;
    }

    const now = new Date();
    const since30d = subtractHours(now, Math.max(...REPORT_WINDOWS.map((window) => window.hours)));

    const [checks, recentIncidents, recentNotifications] = await Promise.all([
      this.prisma.checkResult.findMany({
        where: {
          monitorId,
          checkedAt: {
            gte: since30d,
          },
        },
        select: {
          id: true,
          monitorId: true,
          checkedAt: true,
          success: true,
          statusCode: true,
          responseTimeMs: true,
          errorMessage: true,
          contentMatched: true,
          jsonMatched: true,
        },
        orderBy: {
          checkedAt: "desc",
        },
      }),
      this.prisma.incident.findMany({
        where: {
          monitorId,
        },
        orderBy: {
          startedAt: "desc",
        },
        take: DEFAULT_INCIDENT_DETAILS_LIMIT,
        include: {
          monitor: {
            include: {
              user: true,
            },
          },
        },
      }),
      this.prisma.notificationLog.findMany({
        where: {
          monitorId,
        },
        orderBy: {
          sentAt: "desc",
        },
        take: DEFAULT_NOTIFICATION_DETAILS_LIMIT,
        select: {
          id: true,
          type: true,
          sentAt: true,
          payload: true,
        },
      }),
    ]);

    const stats24h = calculateUptimeStatistics(checks.filter((check) => check.checkedAt >= subtractHours(now, 24)));
    const openIncident = monitor.incidents[0] ?? null;

    return {
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        currentState: monitor.currentState,
        isActive: monitor.isActive,
        intervalMinutes: monitor.intervalMinutes,
        timeoutMs: monitor.timeoutMs,
        consecutiveFailures: monitor.consecutiveFailures,
        failureThreshold: monitor.failureThreshold,
        recoveryThreshold: monitor.recoveryThreshold,
        lastCheckedAt: monitor.lastCheckedAt,
        lastStatusCode: monitor.lastStatusCode,
        lastResponseTimeMs: monitor.lastResponseTimeMs,
        lastErrorMessage: monitor.lastErrorMessage,
        requiredText: monitor.requiredText,
        checkSsl: monitor.checkSsl,
        checkJson: monitor.checkJson,
        endsAt: monitor.endsAt,
        createdAt: monitor.createdAt,
        updatedAt: monitor.updatedAt,
        user: buildUserSummary(monitor.user),
        probes: buildProbeSummaries(),
        uptimePercent24h: stats24h.uptimePercent,
        totalChecks24h: stats24h.totalChecks,
        successfulChecks24h: stats24h.successfulChecks,
        averageResponseTimeMs24h: stats24h.averageResponseTimeMs,
        openIncident: openIncident !== null,
        openIncidentStartedAt: openIncident?.startedAt ?? null,
        totalIncidents: monitor._count.incidents,
      },
      windows: REPORT_WINDOWS.map((window) => {
        const stats = calculateUptimeStatistics(checks.filter((check) => check.checkedAt >= subtractHours(now, window.hours)));

        return {
          label: window.key,
          totalChecks: stats.totalChecks,
          successfulChecks: stats.successfulChecks,
          uptimePercent: stats.uptimePercent,
        };
      }),
      recentChecks: checks.slice(0, DEFAULT_MONITOR_DETAILS_LIMIT).map((check) => ({
        id: check.id,
        monitorProbeId: null,
        probeId: null,
        probeName: null,
        probeRegionCode: null,
        checkedAt: check.checkedAt,
        success: check.success,
        statusCode: check.statusCode,
        responseTimeMs: check.responseTimeMs,
        errorMessage: check.errorMessage,
        contentMatched: check.contentMatched,
        jsonMatched: check.jsonMatched,
      })),
      recentIncidents: recentIncidents.map(mapIncident),
      recentNotifications,
    };
  }
}
