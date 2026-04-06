import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { AppServices } from "../app/services";
import { JOB_NAMES, QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { IncidentTransitionJobPayload } from "../queue/job-payloads";

export function createIncidentWorker(services: AppServices, connection: Redis): Worker<IncidentTransitionJobPayload> {
  return new Worker<IncidentTransitionJobPayload>(
    QUEUE_NAMES.incidents,
    async (job) => {
      if (job.name !== JOB_NAMES.incidentTransition) {
        return;
      }

      await services.incidentService.processTransition(job.data);
    },
    {
      connection,
      concurrency: env.INCIDENT_WORKER_CONCURRENCY,
    },
  ).on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id }, "Incident worker failed");
  });
}
