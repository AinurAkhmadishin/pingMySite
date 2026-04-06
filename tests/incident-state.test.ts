import { MonitorState } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { resolveIncidentState } from "../src/modules/incidents/incident-state";

describe("incident state machine", () => {
  it("opens an incident only after the third consecutive failure", () => {
    const first = resolveIncidentState({
      currentState: MonitorState.UP,
      consecutiveFailures: 0,
      failureThreshold: 3,
      recoveryThreshold: 1,
      success: false,
    });

    const second = resolveIncidentState({
      currentState: first.nextState,
      consecutiveFailures: first.nextConsecutiveFailures,
      failureThreshold: 3,
      recoveryThreshold: 1,
      success: false,
    });

    const third = resolveIncidentState({
      currentState: second.nextState,
      consecutiveFailures: second.nextConsecutiveFailures,
      failureThreshold: 3,
      recoveryThreshold: 1,
      success: false,
    });

    expect(first.transition).toBe("NONE");
    expect(second.transition).toBe("NONE");
    expect(third.transition).toBe("DOWN_CONFIRMED");
    expect(third.nextState).toBe(MonitorState.DOWN);
  });

  it("marks a down monitor as recovered after one successful check", () => {
    const recovered = resolveIncidentState({
      currentState: MonitorState.DOWN,
      consecutiveFailures: 3,
      failureThreshold: 3,
      recoveryThreshold: 1,
      success: true,
    });

    expect(recovered.transition).toBe("RECOVERED");
    expect(recovered.nextState).toBe(MonitorState.UP);
    expect(recovered.nextConsecutiveFailures).toBe(0);
  });
});
