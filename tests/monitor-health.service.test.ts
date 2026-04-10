import { MonitorState } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env", () => ({
  env: {
    UNKNOWN_MONITOR_STALE_AFTER_MINUTES: 15,
  },
}));

import { MonitorHealthService } from "../src/modules/monitors/monitor-health.service";

describe("monitor health service", () => {
  it("counts active monitors stuck in UNKNOWN past the threshold", async () => {
    const prisma = {
      monitor: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "monitor_1",
            userId: "user_1",
            name: "Example",
            url: "https://example.com/",
            intervalMinutes: 5,
            createdAt: new Date("2026-04-08T11:00:00.000Z"),
            updatedAt: new Date("2026-04-08T11:10:00.000Z"),
            lastCheckedAt: null,
          },
        ]),
      },
    };
    const service = new MonitorHealthService(prisma as never);
    const now = new Date("2026-04-08T12:00:00.000Z");

    const summary = await service.getStuckUnknownSummary(now);

    expect(prisma.monitor.count).toHaveBeenCalledWith({
      where: {
        currentState: MonitorState.UNKNOWN,
        updatedAt: {
          lte: new Date("2026-04-08T11:45:00.000Z"),
        },
        deletedAt: null,
        isActive: true,
      },
    });
    expect(prisma.monitor.findMany).toHaveBeenCalledWith({
      where: {
        currentState: MonitorState.UNKNOWN,
        updatedAt: {
          lte: new Date("2026-04-08T11:45:00.000Z"),
        },
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        url: true,
        intervalMinutes: true,
        createdAt: true,
        updatedAt: true,
        lastCheckedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 5,
    });
    expect(summary.count).toBe(2);
    expect(summary.staleAfterMinutes).toBe(15);
    expect(summary.monitors).toHaveLength(1);
    expect(summary.monitors[0]).toMatchObject({
      id: "monitor_1",
      userId: "user_1",
      name: "Example",
    });
  });
});
