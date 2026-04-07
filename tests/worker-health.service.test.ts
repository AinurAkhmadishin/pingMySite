import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    WORKER_HEARTBEAT_INTERVAL_SECONDS: 30,
    WORKER_HEARTBEAT_STALE_AFTER_SECONDS: 90,
  },
}));

import { WorkerHealthService } from "../src/modules/system/worker-health.service";

afterEach(() => {
  vi.useRealTimers();
});

describe("worker health service", () => {
  it("reports worker as unhealthy when heartbeat is missing", async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(null),
    };
    const service = new WorkerHealthService(redis as never);

    const status = await service.getWorkerStatus(new Date("2026-04-08T12:00:00.000Z"));

    expect(status.isAlive).toBe(false);
    expect(status.updatedAt).toBeNull();
    expect(status.ageSeconds).toBeNull();
  });

  it("updates heartbeat on interval and clears it on stop", async () => {
    vi.useFakeTimers();

    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };
    const service = new WorkerHealthService(redis as never);

    const runtime = await service.startHeartbeat();

    expect(redis.set).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(redis.set).toHaveBeenCalledTimes(2);

    await runtime.stop();

    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it("marks worker as stale when the heartbeat is too old", async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          pid: 123,
          startedAt: "2026-04-08T11:00:00.000Z",
          updatedAt: "2026-04-08T11:58:00.000Z",
        }),
      ),
    };
    const service = new WorkerHealthService(redis as never);

    const status = await service.getWorkerStatus(new Date("2026-04-08T12:00:00.000Z"));

    expect(status.isAlive).toBe(false);
    expect(status.ageSeconds).toBe(120);
    expect(status.pid).toBe(123);
  });
});
