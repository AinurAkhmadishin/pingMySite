export interface UptimeCheckSample {
  success: boolean;
  responseTimeMs?: number | null;
  checkedAt: Date;
}

export interface UptimeStatistics {
  totalChecks: number;
  successfulChecks: number;
  uptimePercent: number;
  averageResponseTimeMs: number | null;
}

export function calculateUptimeStatistics(checks: UptimeCheckSample[]): UptimeStatistics {
  const totalChecks = checks.length;
  const successfulChecks = checks.filter((check) => check.success).length;
  const successfulResponses = checks
    .filter((check) => check.success && typeof check.responseTimeMs === "number")
    .map((check) => check.responseTimeMs as number);

  const averageResponseTimeMs =
    successfulResponses.length > 0
      ? Math.round(successfulResponses.reduce((sum, value) => sum + value, 0) / successfulResponses.length)
      : null;

  // Transparent uptime formula:
  // uptimePercent = successfulChecks / totalChecks * 100
  const uptimePercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;

  return {
    totalChecks,
    successfulChecks,
    uptimePercent: Number(uptimePercent.toFixed(2)),
    averageResponseTimeMs,
  };
}
