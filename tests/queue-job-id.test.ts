import { describe, expect, it } from "vitest";

import {
  buildIncidentTransitionJobId,
  buildManualCheckJobId,
  buildScheduledMonitorJobId,
  buildSslCheckJobId,
} from "../src/queue/queues";

describe("incident transition job id", () => {
  it("sanitizes ISO timestamps so BullMQ accepts the custom job id", () => {
    const jobId = buildIncidentTransitionJobId({
      monitorId: "monitor_1",
      transition: "DOWN_CONFIRMED",
      reason: "HTTP 500",
      checkedAt: "2026-04-07T16:07:25.922Z",
      consecutiveFailures: 3,
    });

    expect(jobId).toBe("incident-monitor_1-DOWN_CONFIRMED-2026-04-07T16-07-25-922Z");
    expect(jobId).not.toContain(":");
  });

  it("builds colon-free job ids for other queues too", () => {
    expect(buildScheduledMonitorJobId("monitor_1")).toBe("monitor-monitor_1");
    expect(buildManualCheckJobId("monitor_1", 123456)).toBe("manual-monitor_1-123456");
    expect(buildSslCheckJobId("monitor_1", 123456)).toBe("ssl-monitor_1-123456");
  });
});
