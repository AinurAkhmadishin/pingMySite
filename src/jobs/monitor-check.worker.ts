import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { AppServices } from "../app/services";
import { JOB_NAMES, QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { MonitorCheckJobPayload } from "../queue/job-payloads";

export function createMonitorCheckWorker(services: AppServices, connection: Redis): Worker<MonitorCheckJobPayload> {
  return new Worker<MonitorCheckJobPayload>(
    QUEUE_NAMES.monitorChecks,
    async (job) => {
      if (job.name !== JOB_NAMES.scheduledMonitorCheck && job.name !== JOB_NAMES.manualMonitorCheck) {
        return;
      }

      if (!job.data.monitorId) {
        logger.warn({ jobId: job.id, payload: job.data }, "Skipping legacy monitor check job without monitorId");
        return;
      }

      await services.monitorCheckService.runMonitorCheck(job.data.monitorId, job.data.origin);
    },
    {
      connection,
      concurrency: env.MONITOR_WORKER_CONCURRENCY,
    },
  ).on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id }, "Monitor check worker failed");
  });
}
