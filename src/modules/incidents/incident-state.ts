import { MonitorState } from "@prisma/client";

export type IncidentTransitionType = "DOWN_CONFIRMED" | "RECOVERED" | "NONE";

export interface IncidentStateInput {
  currentState: MonitorState;
  consecutiveFailures: number;
  failureThreshold: number;
  recoveryThreshold: number;
  success: boolean;
}

export interface IncidentStateDecision {
  nextState: MonitorState;
  nextConsecutiveFailures: number;
  transition: IncidentTransitionType;
}

export function resolveIncidentState(input: IncidentStateInput): IncidentStateDecision {
  if (input.success) {
    if (input.currentState === MonitorState.DOWN) {
      return {
        nextState: MonitorState.UP,
        nextConsecutiveFailures: 0,
        transition: "RECOVERED",
      };
    }

    return {
      nextState: MonitorState.UP,
      nextConsecutiveFailures: 0,
      transition: "NONE",
    };
  }

  const nextConsecutiveFailures = input.consecutiveFailures + 1;

  if (input.currentState !== MonitorState.DOWN && nextConsecutiveFailures >= input.failureThreshold) {
    return {
      nextState: MonitorState.DOWN,
      nextConsecutiveFailures,
      transition: "DOWN_CONFIRMED",
    };
  }

  return {
    nextState: input.currentState,
    nextConsecutiveFailures,
    transition: "NONE",
  };
}
