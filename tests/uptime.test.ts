import { describe, expect, it } from "vitest";

import { calculateUptimeStatistics } from "../src/modules/reports/uptime";

describe("uptime calculation", () => {
  it("calculates uptime percent and average response time", () => {
    const stats = calculateUptimeStatistics([
      { success: true, responseTimeMs: 100, checkedAt: new Date("2026-04-01T00:00:00Z") },
      { success: true, responseTimeMs: 300, checkedAt: new Date("2026-04-01T00:01:00Z") },
      { success: false, responseTimeMs: null, checkedAt: new Date("2026-04-01T00:02:00Z") },
      { success: true, responseTimeMs: 200, checkedAt: new Date("2026-04-01T00:03:00Z") },
    ]);

    expect(stats.totalChecks).toBe(4);
    expect(stats.successfulChecks).toBe(3);
    expect(stats.uptimePercent).toBe(75);
    expect(stats.averageResponseTimeMs).toBe(200);
  });
});
