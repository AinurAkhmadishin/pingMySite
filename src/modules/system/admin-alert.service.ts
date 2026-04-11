import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { MonitorHealthService } from "../monitors/monitor-health.service";
import { NotificationService } from "../notifications/notification.service";
import {
  buildAdminHealthAlertMessage,
  buildAdminHealthRecoveredMessage,
} from "../notifications/message-builder";
import { WorkerHealthService } from "./worker-health.service";

export class AdminAlertService {
  private lastState: "unknown" | "healthy" | "unhealthy" = "unknown";
  private lastFingerprint: string | null = null;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly workerHealthService: WorkerHealthService,
    private readonly monitorHealthService: MonitorHealthService,
  ) {}

  async inspectAndNotify(): Promise<void> {
    if (!env.ENABLE_ADMIN_ALERTS || !env.ADMIN_TELEGRAM_CHAT_ID) {
      return;
    }

    const [worker, stuckUnknown] = await Promise.all([
      this.workerHealthService.getWorkerStatus(),
      this.monitorHealthService.getStuckUnknownSummary(),
    ]);

    const healthy = worker.isAlive && stuckUnknown.count === 0;
    const fingerprint = JSON.stringify({
      workerAlive: worker.isAlive,
      stuckUnknownCount: stuckUnknown.count,
    });

    if (healthy) {
      if (this.lastState === "unhealthy") {
        await this.notificationService.sendPlainMessage(
          env.ADMIN_TELEGRAM_CHAT_ID,
          buildAdminHealthRecoveredMessage(),
        );
      }

      this.lastState = "healthy";
      this.lastFingerprint = fingerprint;
      return;
    }

    if (this.lastState === "unhealthy" && this.lastFingerprint === fingerprint) {
      return;
    }

    try {
      await this.notificationService.sendPlainMessage(
        env.ADMIN_TELEGRAM_CHAT_ID,
        buildAdminHealthAlertMessage({
          workerAlive: worker.isAlive,
          stuckUnknownCount: stuckUnknown.count,
          staleAfterMinutes: stuckUnknown.staleAfterMinutes,
        }),
      );
    } catch (error) {
      logger.error({ err: error }, "Failed to send admin health alert");
      return;
    }

    this.lastState = "unhealthy";
    this.lastFingerprint = fingerprint;
  }
}
