import { IncidentTransitionType } from "../modules/incidents/incident-state";

export interface MonitorCheckJobPayload {
  monitorId?: string;
  monitorProbeId?: string;
  origin: "scheduled" | "manual";
}

export interface IncidentTransitionJobPayload {
  monitorId: string;
  transition: IncidentTransitionType;
  reason: string;
  checkedAt: string;
  statusCode?: number;
  responseTimeMs?: number;
  consecutiveFailures: number;
}

export interface SslCheckJobPayload {
  monitorId: string;
}

export interface SummaryJobPayload {
  frequency: "daily" | "weekly";
}
