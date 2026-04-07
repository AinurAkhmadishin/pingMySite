import { Redis } from "ioredis";

import { env } from "../../config/env";
import { logger } from "../../lib/logger";

const WORKER_HEARTBEAT_KEY = "system:worker:heartbeat";

interface WorkerHeartbeatPayload {
  pid: number;
  startedAt: string;
  updatedAt: string;
}

export interface WorkerHeartbeatStatus {
  isAlive: boolean;
  pid: number | null;
  startedAt: Date | null;
  updatedAt: Date | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
}

export interface WorkerHeartbeatRuntime {
  stop: () => Promise<void>;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export class WorkerHealthService {
  constructor(private readonly redis: Redis) {}

  private async writeHeartbeat(startedAt: Date): Promise<void> {
    const payload: WorkerHeartbeatPayload = {
      pid: process.pid,
      startedAt: startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.redis.set(
      WORKER_HEARTBEAT_KEY,
      JSON.stringify(payload),
      "EX",
      env.WORKER_HEARTBEAT_STALE_AFTER_SECONDS * 2,
    );
  }

  async startHeartbeat(): Promise<WorkerHeartbeatRuntime> {
    const startedAt = new Date();

    await this.writeHeartbeat(startedAt);

    const timer = setInterval(() => {
      void this.writeHeartbeat(startedAt).catch((error) => {
        logger.error({ err: error }, "Failed to update worker heartbeat");
      });
    }, env.WORKER_HEARTBEAT_INTERVAL_SECONDS * 1000);

    timer.unref?.();

    return {
      stop: async () => {
        clearInterval(timer);
        await this.redis.del(WORKER_HEARTBEAT_KEY);
      },
    };
  }

  async getWorkerStatus(now: Date = new Date()): Promise<WorkerHeartbeatStatus> {
    const rawPayload = await this.redis.get(WORKER_HEARTBEAT_KEY);

    if (!rawPayload) {
      return {
        isAlive: false,
        pid: null,
        startedAt: null,
        updatedAt: null,
        ageSeconds: null,
        staleAfterSeconds: env.WORKER_HEARTBEAT_STALE_AFTER_SECONDS,
      };
    }

    try {
      const payload = JSON.parse(rawPayload) as Partial<WorkerHeartbeatPayload>;
      const startedAt = parseDate(payload.startedAt);
      const updatedAt = parseDate(payload.updatedAt);
      const ageSeconds =
        updatedAt === null ? null : Math.max(0, Math.round((now.getTime() - updatedAt.getTime()) / 1000));

      return {
        isAlive: ageSeconds !== null && ageSeconds <= env.WORKER_HEARTBEAT_STALE_AFTER_SECONDS,
        pid: typeof payload.pid === "number" ? payload.pid : null,
        startedAt,
        updatedAt,
        ageSeconds,
        staleAfterSeconds: env.WORKER_HEARTBEAT_STALE_AFTER_SECONDS,
      };
    } catch (error) {
      logger.warn({ err: error }, "Failed to parse worker heartbeat payload");

      return {
        isAlive: false,
        pid: null,
        startedAt: null,
        updatedAt: null,
        ageSeconds: null,
        staleAfterSeconds: env.WORKER_HEARTBEAT_STALE_AFTER_SECONDS,
      };
    }
  }
}
