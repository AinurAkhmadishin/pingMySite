import { FunnelSessionKind, FunnelSessionStatus } from "@prisma/client";

import { AddMonitorFunnelStep, ADD_MONITOR_FUNNEL_STEPS } from "./funnel.constants";
import { FunnelRepository } from "./funnel.repository";

export class FunnelService {
  constructor(private readonly funnelRepository: FunnelRepository) {}

  async startAddMonitorSession(userId: string, payload?: Record<string, unknown> | null) {
    return this.funnelRepository.startSession({
      userId,
      kind: FunnelSessionKind.ADD_MONITOR,
      stepKey: ADD_MONITOR_FUNNEL_STEPS.awaitingUrl.key,
      stepLabel: ADD_MONITOR_FUNNEL_STEPS.awaitingUrl.label,
      payload,
    });
  }

  async setAddMonitorStep(
    sessionId: string | undefined,
    userId: string,
    step: AddMonitorFunnelStep,
    payload?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.funnelRepository.setCurrentStep({
      sessionId,
      userId,
      stepKey: step.key,
      stepLabel: step.label,
      payload,
    });
  }

  async appendAddMonitorEvent(
    sessionId: string | undefined,
    userId: string,
    step: AddMonitorFunnelStep,
    payload?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.funnelRepository.appendEvent({
      sessionId,
      userId,
      stepKey: step.key,
      stepLabel: step.label,
      payload,
    });
  }

  async completeAddMonitorSession(
    sessionId: string | undefined,
    userId: string,
    step: AddMonitorFunnelStep,
    payload?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.funnelRepository.finishSession({
      sessionId,
      userId,
      status: FunnelSessionStatus.COMPLETED,
      stepKey: step.key,
      stepLabel: step.label,
      payload,
    });
  }

  async stopAddMonitorSession(
    sessionId: string | undefined,
    userId: string,
    step: AddMonitorFunnelStep,
    payload?: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.funnelRepository.finishSession({
      sessionId,
      userId,
      status: FunnelSessionStatus.STOPPED,
      stepKey: step.key,
      stepLabel: step.label,
      payload,
    });
  }
}
