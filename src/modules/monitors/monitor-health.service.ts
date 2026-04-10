import { MonitorState, PrismaClient } from "@prisma/client";

import { env } from "../../config/env";

export interface StuckUnknownMonitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  intervalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
}

export interface StuckUnknownMonitorSummary {
  count: number;
  staleAfterMinutes: number;
  thresholdStartedBefore: Date;
  monitors: StuckUnknownMonitor[];
}

export class MonitorHealthService {
  constructor(private readonly prisma: PrismaClient) {}

  private buildStuckUnknownWhere(now: Date) {
    const thresholdDate = new Date(now.getTime() - env.UNKNOWN_MONITOR_STALE_AFTER_MINUTES * 60 * 1000);

    return {
      currentState: MonitorState.UNKNOWN,
      updatedAt: {
        lte: thresholdDate,
      },
      deletedAt: null,
      isActive: true,
    };
  }

  async countStuckUnknownMonitors(now: Date = new Date()): Promise<number> {
    return this.prisma.monitor.count({
      where: this.buildStuckUnknownWhere(now),
    });
  }

  async listStuckUnknownMonitors(limit: number = 5, now: Date = new Date()): Promise<StuckUnknownMonitor[]> {
    const rows = await this.prisma.monitor.findMany({
      where: this.buildStuckUnknownWhere(now),
      select: {
        id: true,
        userId: true,
        name: true,
        url: true,
        intervalMinutes: true,
        createdAt: true,
        updatedAt: true,
        lastCheckedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      url: row.url,
      intervalMinutes: row.intervalMinutes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastCheckedAt: row.lastCheckedAt,
    }));
  }

  async getStuckUnknownSummary(now: Date = new Date(), limit: number = 5): Promise<StuckUnknownMonitorSummary> {
    const thresholdStartedBefore = new Date(now.getTime() - env.UNKNOWN_MONITOR_STALE_AFTER_MINUTES * 60 * 1000);
    const [count, monitors] = await Promise.all([
      this.countStuckUnknownMonitors(now),
      this.listStuckUnknownMonitors(limit, now),
    ]);

    return {
      count,
      staleAfterMinutes: env.UNKNOWN_MONITOR_STALE_AFTER_MINUTES,
      thresholdStartedBefore,
      monitors,
    };
  }
}
