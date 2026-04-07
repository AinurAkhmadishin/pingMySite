import { JobsOptions, Queue, RepeatableJob } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env";
import { JOB_NAMES, QUEUE_NAMES } from "../config/constants";
import { logger } from "../lib/logger";
import { IncidentPublisherPort, SslPublisherPort } from "../modules/monitors/monitor-check.service";
import { MonitorSchedulerPort } from "../modules/monitors/monitor.service";
import {
  IncidentTransitionJobPayload,
  MonitorCheckJobPayload,
  SummaryJobPayload,
  SslCheckJobPayload,
} from "./job-payloads";

function defaultJobOptions(): JobsOptions {
  return {
    removeOnComplete: 500,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  };
}

function sanitizeJobIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function buildScheduledMonitorJobId(monitorId: string): string {
  return `monitor-${sanitizeJobIdPart(monitorId)}`;
}

export function buildManualCheckJobId(monitorId: string, timestamp: number): string {
  return `manual-${sanitizeJobIdPart(monitorId)}-${timestamp}`;
}

export function buildIncidentTransitionJobId(payload: IncidentTransitionJobPayload): string {
  return `incident-${sanitizeJobIdPart(payload.monitorId)}-${sanitizeJobIdPart(payload.transition)}-${sanitizeJobIdPart(
    payload.checkedAt,
  )}`;
}

export function buildSslCheckJobId(monitorId: string, timestamp: number): string {
  return `ssl-${sanitizeJobIdPart(monitorId)}-${timestamp}`;
}

export class QueueManager implements MonitorSchedulerPort, IncidentPublisherPort, SslPublisherPort {
  readonly monitorCheckQueue: Queue<MonitorCheckJobPayload>;
  readonly incidentQueue: Queue<IncidentTransitionJobPayload>;
  readonly sslQueue: Queue<SslCheckJobPayload>;
  readonly summaryQueue: Queue<SummaryJobPayload>;

  constructor(private readonly connection: Redis) {
    this.monitorCheckQueue = new Queue<MonitorCheckJobPayload>(QUEUE_NAMES.monitorChecks, {
      connection: this.connection,
      defaultJobOptions: defaultJobOptions(),
    });

    this.incidentQueue = new Queue<IncidentTransitionJobPayload>(QUEUE_NAMES.incidents, {
      connection: this.connection,
      defaultJobOptions: defaultJobOptions(),
    });

    this.sslQueue = new Queue<SslCheckJobPayload>(QUEUE_NAMES.ssl, {
      connection: this.connection,
      defaultJobOptions: defaultJobOptions(),
    });

    this.summaryQueue = new Queue<SummaryJobPayload>(QUEUE_NAMES.summaries, {
      connection: this.connection,
      defaultJobOptions: defaultJobOptions(),
    });
  }

  async scheduleMonitor(monitorId: string, intervalMinutes: number): Promise<void> {
    await this.removeMonitorSchedule(monitorId);

    await this.monitorCheckQueue.add(
      JOB_NAMES.scheduledMonitorCheck,
      {
        monitorId,
        origin: "scheduled",
      },
      {
        ...defaultJobOptions(),
        jobId: buildScheduledMonitorJobId(monitorId),
        repeat: {
          every: intervalMinutes * 60 * 1000,
        },
      },
    );
  }

  async removeMonitorSchedule(monitorId: string): Promise<void> {
    const repeatableJobs = await this.monitorCheckQueue.getRepeatableJobs();

    await Promise.all(
      repeatableJobs
        .filter((job) => job.id === buildScheduledMonitorJobId(monitorId))
        .map((job) => this.monitorCheckQueue.removeRepeatableByKey(job.key)),
    );
  }

  async enqueueManualCheck(monitorId: string): Promise<void> {
    await this.monitorCheckQueue.add(
      JOB_NAMES.manualMonitorCheck,
      {
        monitorId,
        origin: "manual",
      },
      {
        ...defaultJobOptions(),
        jobId: buildManualCheckJobId(monitorId, Date.now()),
      },
    );
  }

  async publishIncidentTransition(payload: IncidentTransitionJobPayload): Promise<void> {
    await this.incidentQueue.add(JOB_NAMES.incidentTransition, payload, {
      ...defaultJobOptions(),
      jobId: buildIncidentTransitionJobId(payload),
    });
  }

  async publishSslCheck(payload: SslCheckJobPayload): Promise<void> {
    await this.sslQueue.add(JOB_NAMES.sslCheck, payload, {
      ...defaultJobOptions(),
      jobId: buildSslCheckJobId(payload.monitorId, Date.now()),
    });
  }

  async ensureSummaryJobs(): Promise<void> {
    if (env.ENABLE_DAILY_SUMMARIES) {
      await this.summaryQueue.add(
        JOB_NAMES.dailySummary,
        {
          frequency: "daily",
        },
        {
          ...defaultJobOptions(),
          jobId: "summary-daily",
          repeat: {
            every: 24 * 60 * 60 * 1000,
          },
        },
      );
    }

    if (env.ENABLE_WEEKLY_SUMMARIES) {
      await this.summaryQueue.add(
        JOB_NAMES.weeklySummary,
        {
          frequency: "weekly",
        },
        {
          ...defaultJobOptions(),
          jobId: "summary-weekly",
          repeat: {
            every: 7 * 24 * 60 * 60 * 1000,
          },
        },
      );
    }
  }

  async syncMonitorSchedules(monitors: Array<{ id: string; intervalMinutes: number }>): Promise<void> {
    const repeatableJobs = await this.monitorCheckQueue.getRepeatableJobs();
    const activeMonitorIds = new Set(monitors.map((monitor) => buildScheduledMonitorJobId(monitor.id)));

    await Promise.all(
      repeatableJobs
        .filter((job) => job.id && !activeMonitorIds.has(job.id))
        .map((job) => this.monitorCheckQueue.removeRepeatableByKey(job.key)),
    );

    for (const monitor of monitors) {
      await this.scheduleMonitor(monitor.id, monitor.intervalMinutes);
    }

    logger.info({ monitorCount: monitors.length }, "Monitor schedules synchronized");
  }

  async close(): Promise<void> {
    await Promise.all([
      this.monitorCheckQueue.close(),
      this.incidentQueue.close(),
      this.sslQueue.close(),
      this.summaryQueue.close(),
    ]);
  }
}
