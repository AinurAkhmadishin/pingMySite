import { MonitorRepository } from "../monitors/monitor.repository";
import { NotificationService } from "../notifications/notification.service";
import { IncidentRepository } from "./incident.repository";
import { IncidentTransitionJobPayload } from "../../queue/job-payloads";

export class IncidentService {
  constructor(
    private readonly incidentRepository: IncidentRepository,
    private readonly monitorRepository: MonitorRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async processTransition(payload: IncidentTransitionJobPayload): Promise<void> {
    const monitor = await this.monitorRepository.findByIdWithUser(payload.monitorId);

    if (!monitor || monitor.deletedAt) {
      return;
    }

    if (payload.transition === "DOWN_CONFIRMED") {
      const existingOpenIncident = await this.incidentRepository.findOpenByMonitorId(payload.monitorId);

      if (existingOpenIncident) {
        return;
      }

      await this.incidentRepository.createIncident({
        monitorId: monitor.id,
        startedAt: new Date(payload.checkedAt),
        reason: payload.reason,
        status: "OPEN",
        openedAfterFailures: payload.consecutiveFailures,
      });

      await this.notificationService.sendDownAlert(monitor, {
        reason: payload.reason,
        checkedAt: new Date(payload.checkedAt),
        consecutiveFailures: payload.consecutiveFailures,
      });

      return;
    }

    if (payload.transition === "RECOVERED") {
      const openIncident = await this.incidentRepository.findOpenByMonitorId(payload.monitorId);

      if (!openIncident) {
        return;
      }

      const recoveredAt = new Date(payload.checkedAt);
      const durationSeconds = Math.max(0, Math.round((recoveredAt.getTime() - openIncident.startedAt.getTime()) / 1000));

      await this.incidentRepository.resolveIncident(openIncident.id, recoveredAt, durationSeconds);
      await this.notificationService.sendRecoveryAlert(monitor, {
        statusCode: payload.statusCode,
        recoveredAt,
        durationSeconds,
      });
    }
  }
}
