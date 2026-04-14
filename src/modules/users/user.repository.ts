import { PrismaClient, User } from "@prisma/client";

export interface UpsertTelegramUserInput {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  timezone: string;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertTelegramUser(input: UpsertTelegramUserInput): Promise<User> {
    return this.prisma.user.upsert({
      where: {
        telegramId: input.telegramId,
      },
      update: {
        username: input.username ?? undefined,
        firstName: input.firstName ?? undefined,
        timezone: input.timezone,
      },
      create: {
        telegramId: input.telegramId,
        username: input.username ?? undefined,
        firstName: input.firstName ?? undefined,
        timezone: input.timezone,
      },
    });
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        telegramId,
      },
    });
  }

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  async updateDailySummarySettings(
    userId: string,
    input: {
      enabled?: boolean;
      timeMinutes?: number | null;
      lastSentAt?: Date | null;
      promptedAt?: Date;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        dailySummaryEnabled: input.enabled,
        dailySummaryTimeMinutes: input.timeMinutes,
        dailySummaryLastSentAt: input.lastSentAt,
        dailySummaryPromptedAt: input.promptedAt,
      },
    });
  }

  async listUsersDueForDailySummary(timeMinutes: number, dayStart: Date): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        dailySummaryEnabled: true,
        dailySummaryTimeMinutes: {
          lte: timeMinutes,
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
  }

  async listUsersForSummary(frequency: "daily" | "weekly"): Promise<User[]> {
    return this.prisma.user.findMany({
      where: frequency === "daily" ? { dailySummaryEnabled: true } : { weeklySummaryEnabled: true },
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}
