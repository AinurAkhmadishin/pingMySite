import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { AppServices } from "../app/services";
import { JOB_NAMES, QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { SslCheckJobPayload } from "../queue/job-payloads";

export function createSslWorker(services: AppServices, connection: Redis): Worker<SslCheckJobPayload> {
  return new Worker<SslCheckJobPayload>(
    QUEUE_NAMES.ssl,
    async (job) => {
      if (job.name !== JOB_NAMES.sslCheck) {
        return;
      }

      await services.sslService.checkMonitorSsl(job.data.monitorId);
    },
    {
      connection,
      concurrency: env.SSL_WORKER_CONCURRENCY,
    },
  ).on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id }, "SSL worker failed");
  });
}
