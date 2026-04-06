import { MonitorState, Prisma, PrismaClient } from "@prisma/client";

export const monitorWithUserArgs = Prisma.validator<Prisma.MonitorDefaultArgs>()({
  include: {
    user: true,
  },
});

export type MonitorWithUser = Prisma.MonitorGetPayload<typeof monitorWithUserArgs>;

export interface MonitorListFilters {
  onlyPaused?: boolean;
  onlyActive?: boolean;
}

export class MonitorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdWithUser(monitorId: string): Promise<MonitorWithUser | null> {
    return this.prisma.monitor.findUnique({
      where: {
        id: monitorId,
      },
      ...monitorWithUserArgs,
    });
  }

  async findByIdForUser(userId: string, monitorId: string): Promise<MonitorWithUser | null> {
    return this.prisma.monitor.findFirst({
      where: {
        id: monitorId,
        userId,
        deletedAt: null,
      },
      ...monitorWithUserArgs,
    });
  }

  async findExistingByNormalizedUrl(userId: string, normalizedUrl: string): Promise<MonitorWithUser | null> {
    return this.prisma.monitor.findFirst({
      where: {
        userId,
        normalizedUrl,
        deletedAt: null,
      },
      ...monitorWithUserArgs,
    });
  }

  async listByUser(userId: string, filters?: MonitorListFilters): Promise<MonitorWithUser[]> {
    return this.prisma.monitor.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters?.onlyPaused ? { currentState: MonitorState.PAUSED } : {}),
        ...(filters?.onlyActive ? { isActive: true } : {}),
      },
      ...monitorWithUserArgs,
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async listActiveMonitors(): Promise<MonitorWithUser[]> {
    return this.prisma.monitor.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      ...monitorWithUserArgs,
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async createMonitor(data: Prisma.MonitorUncheckedCreateInput): Promise<MonitorWithUser> {
    return this.prisma.monitor.create({
      data,
      ...monitorWithUserArgs,
    });
  }

  async updateMonitor(
    monitorId: string,
    data: Prisma.MonitorUncheckedUpdateInput,
  ): Promise<MonitorWithUser> {
    return this.prisma.monitor.update({
      where: {
        id: monitorId,
      },
      data,
      ...monitorWithUserArgs,
    });
  }

  async createCheckResult(data: Prisma.CheckResultUncheckedCreateInput): Promise<void> {
    await this.prisma.checkResult.create({
      data,
    });
  }

  async softDeleteMonitor(monitorId: string, deletedAt: Date): Promise<MonitorWithUser> {
    return this.updateMonitor(monitorId, {
      deletedAt,
      isActive: false,
      currentState: MonitorState.PAUSED,
    });
  }
}
