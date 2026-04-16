import { describe, expect, it, vi } from "vitest";

import { UserRepository } from "../src/modules/users/user.repository";

describe("user repository", () => {
  it("selects daily summary users whose scheduled Moscow time has already passed today", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new UserRepository({
      user: {
        findMany,
      },
    } as never);
    const dayStart = new Date("2026-04-12T21:00:00.000Z");

    await repository.listUsersDueForDailySummary(1192, dayStart);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        dailySummaryEnabled: true,
        dailySummaryTimeMinutes: {
          lte: 1192,
        },
        OR: [
          {
            dailySummaryLastSentAt: null,
          },
          {
            dailySummaryLastSentAt: {
              lt: dayStart,
            },
          },
        ],
      },
      orderBy: [
        {
          dailySummaryTimeMinutes: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
  });
});
