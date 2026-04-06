import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { AppServices } from "../app/services";
import { JOB_NAMES, QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { SummaryJobPayload } from "../queue/job-payloads";

export function createSummaryWorker(services: AppServices, connection: Redis): Worker<SummaryJobPayload> {
  return new Worker<SummaryJobPayload>(
    QUEUE_NAMES.summaries,
    async (job) => {
      if (job.name !== JOB_NAMES.dailySummary && job.name !== JOB_NAMES.weeklySummary) {
        return;
      }

      await services.summaryService.run(job.data.frequency);
    },
    {
      connection,
      concurrency: env.SUMMARY_WORKER_CONCURRENCY,
    },
  ).on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id }, "Summary worker failed");
  });
}
