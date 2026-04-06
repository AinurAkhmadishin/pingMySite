import { Worker } from "bullmq";

import { AppServices } from "../app/services";
import { logger } from "../lib/logger";
import { createRedisConnection } from "../queue/connection";
import { createIncidentWorker } from "./incident.worker";
import { createMonitorCheckWorker } from "./monitor-check.worker";
import { createSslWorker } from "./ssl.worker";
import { createSummaryWorker } from "./summary.worker";

export interface WorkerRuntime {
  close: () => Promise<void>;
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

  logger.info("Workers started");

  return {
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(connections.map((connection) => connection.quit()));
    },
  };
}
