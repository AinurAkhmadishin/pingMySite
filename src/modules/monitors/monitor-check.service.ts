import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { Redis } from "ioredis";

import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { isHttpsUrl } from "../../lib/url";
import { HttpChecker } from "../checks/http-checker";
import { MonitorCheckExecutionResult } from "../checks/types";
import { resolveIncidentState } from "../incidents/incident-state";
import { jsonRulesSchema } from "./monitor.schemas";
import { MonitorRepository, MonitorWithUser } from "./monitor.repository";
import { IncidentTransitionJobPayload, SslCheckJobPayload } from "../../queue/job-payloads";

export interface IncidentPublisherPort {
  publishIncidentTransition(payload: IncidentTransitionJobPayload): Promise<void>;
}

export interface SslPublisherPort {
  publishSslCheck(payload: SslCheckJobPayload): Promise<void>;
}

export interface MonitorCheckRunResult {
  monitor: MonitorWithUser;
  result: MonitorCheckExecutionResult;
  transition: "DOWN_CONFIRMED" | "RECOVERED" | "NONE";
}

export class MonitorCheckService {
  constructor(
    private readonly monitorRepository: MonitorRepository,
    private readonly httpChecker: HttpChecker,
    private readonly incidentPublisher: IncidentPublisherPort,
    private readonly sslPublisher: SslPublisherPort,
    private readonly redis: Redis,
  ) {}

  private lockKey(monitorId: string): string {
    return `monitor-lock:${monitorId}`;
  }

  private async acquireLock(monitorId: string): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(
      this.lockKey(monitorId),
      token,
      "EX",
      env.CHECK_LOCK_TTL_SECONDS,
      "NX",
    );

    return result === "OK" ? token : null;
  }

  private async releaseLock(monitorId: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, this.lockKey(monitorId), token);
  }

  private parseJsonRules(value: Prisma.JsonValue | null): ReturnType<typeof jsonRulesSchema.parse> | null {
    if (value === null) {
      return null;
    }

    return jsonRulesSchema.parse(value);
  }

  async runCheck(monitorId: string, origin: "scheduled" | "manual"): Promise<MonitorCheckRunResult | null> {
    const lockToken = await this.acquireLock(monitorId);

    if (!lockToken) {
      logger.warn({ monitorId }, "Monitor is already being checked");
      return null;
    }

    try {
      const monitor = await this.monitorRepository.findByIdWithUser(monitorId);

      if (!monitor || monitor.deletedAt) {
        return null;
      }

      if (origin === "scheduled" && (!monitor.isActive || monitor.currentState === "PAUSED")) {
        return null;
      }

      const jsonRules = monitor.checkJson ? this.parseJsonRules(monitor.jsonRules) : null;
      const result = await this.httpChecker.execute({
        url: monitor.url,
        timeoutMs: monitor.timeoutMs,
        requiredText: monitor.requiredText,
        checkJson: monitor.checkJson,
        jsonRules,
      });

      const shouldKeepPausedState = origin === "manual" && monitor.currentState === "PAUSED";

      const stateDecision = shouldKeepPausedState
        ? {
            nextState: monitor.currentState,
            nextConsecutiveFailures: monitor.consecutiveFailures,
            transition: "NONE" as const,
          }
        : resolveIncidentState({
            currentState: monitor.currentState,
            consecutiveFailures: monitor.consecutiveFailures,
            failureThreshold: monitor.failureThreshold,
            recoveryThreshold: monitor.recoveryThreshold,
            success: result.success,
          });

      await this.monitorRepository.createCheckResult({
        monitorId: monitor.id,
        success: result.success,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
        contentMatched: result.contentMatched,
        jsonMatched: result.jsonMatched,
        checkedAt: result.checkedAt,
      });

      const updatedMonitor = await this.monitorRepository.updateMonitor(monitor.id, {
        lastCheckedAt: result.checkedAt,
        lastStatusCode: result.statusCode,
        lastResponseTimeMs: result.responseTimeMs,
        lastErrorMessage: result.errorMessage,
        consecutiveFailures: stateDecision.nextConsecutiveFailures,
        currentState: stateDecision.nextState,
      });

      if (stateDecision.transition !== "NONE") {
        await this.incidentPublisher.publishIncidentTransition({
          monitorId: updatedMonitor.id,
          transition: stateDecision.transition,
          reason: result.errorMessage ?? "Неизвестная причина",
          checkedAt: result.checkedAt.toISOString(),
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          consecutiveFailures: stateDecision.nextConsecutiveFailures,
        });
      }

      if (updatedMonitor.checkSsl && isHttpsUrl(updatedMonitor.url)) {
        await this.sslPublisher.publishSslCheck({
          monitorId: updatedMonitor.id,
        });
      }

      return {
        monitor: updatedMonitor,
        result,
        transition: stateDecision.transition,
      };
    } finally {
      await this.releaseLock(monitorId, lockToken);
    }
  }
}
