import { Worker } from "bullmq";

import { AppServices } from "../app/services";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { createRedisConnection } from "../queue/connection";
import { createIncidentWorker } from "./incident.worker";
import { createMonitorCheckWorker } from "./monitor-check.worker";
import { createSslWorker } from "./ssl.worker";
import { createSummaryWorker } from "./summary.worker";

export interface WorkerRuntime {
  close: () => Promise<void>;
}

function startUnknownMonitorDetector(services: AppServices): () => void {
  const runDetector = async () => {
    const summary = await services.monitorHealthService.getStuckUnknownSummary();

    if (summary.count === 0) {
      return;
    }

    logger.warn(
      {
        staleAfterMinutes: summary.staleAfterMinutes,
        count: summary.count,
        monitors: summary.monitors.map((monitor) => ({
          id: monitor.id,
          userId: monitor.userId,
          name: monitor.name,
          url: monitor.url,
          intervalMinutes: monitor.intervalMinutes,
          createdAt: monitor.createdAt.toISOString(),
          updatedAt: monitor.updatedAt.toISOString(),
          lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
        })),
      },
      "Active monitors are stuck in UNKNOWN state",
    );
  };

  void runDetector().catch((error) => {
    logger.error({ err: error }, "Failed to inspect UNKNOWN monitors");
  });

  const timer = setInterval(() => {
    void runDetector().catch((error) => {
      logger.error({ err: error }, "Failed to inspect UNKNOWN monitors");
    });
  }, env.UNKNOWN_MONITOR_SCAN_INTERVAL_SECONDS * 1000);

  timer.unref?.();

  return () => {
    clearInterval(timer);
  };
}

export async function startWorkers(services: AppServices): Promise<WorkerRuntime> {
  const activeMonitors = await services.monitorService.listActiveMonitorsForScheduler();
  await services.queueManager.syncMonitorSchedules(activeMonitors);
  await services.queueManager.ensureSummaryJobs();

  const connections = [createRedisConnection(), createRedisConnection(), createRedisConnection(), createRedisConnection()];
  const workers: Worker[] = [
    createMonitorCheckWorker(services, connections[0]),
    createIncidentWorker(services, connections[1]),
    createSslWorker(services, connections[2]),
    createSummaryWorker(services, connections[3]),
  ];
  const heartbeat = await services.workerHealthService.startHeartbeat();
  const stopUnknownMonitorDetector = startUnknownMonitorDetector(services);

  logger.info("Workers started");

  return {
    close: async () => {
      stopUnknownMonitorDetector();
      await heartbeat.stop();
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(connections.map((connection) => connection.quit()));
    },
  };
}
