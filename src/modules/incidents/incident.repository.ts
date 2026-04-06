import { IncidentStatus, Prisma, PrismaClient } from "@prisma/client";

export const incidentWithMonitorArgs = Prisma.validator<Prisma.IncidentDefaultArgs>()({
  include: {
    monitor: {
      include: {
        user: true,
      },
    },
  },
});

export type IncidentWithMonitor = Prisma.IncidentGetPayload<typeof incidentWithMonitorArgs>;

export class IncidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOpenByMonitorId(monitorId: string): Promise<IncidentWithMonitor | null> {
    return this.prisma.incident.findFirst({
      where: {
        monitorId,
        status: IncidentStatus.OPEN,
      },
      orderBy: {
        startedAt: "desc",
      },
      ...incidentWithMonitorArgs,
    });
  }

  async createIncident(data: Prisma.IncidentUncheckedCreateInput): Promise<IncidentWithMonitor> {
    return this.prisma.incident.create({
      data,
      ...incidentWithMonitorArgs,
    });
  }

  async resolveIncident(incidentId: string, resolvedAt: Date, durationSeconds: number): Promise<IncidentWithMonitor> {
    return this.prisma.incident.update({
      where: {
        id: incidentId,
      },
      data: {
        resolvedAt,
        durationSeconds,
        status: IncidentStatus.RESOLVED,
      },
      ...incidentWithMonitorArgs,
    });
  }

  async countByMonitorId(monitorId: string): Promise<number> {
    return this.prisma.incident.count({
      where: {
        monitorId,
      },
    });
  }

  async findRecentByMonitorId(monitorId: string, limit = 5): Promise<IncidentWithMonitor[]> {
    return this.prisma.incident.findMany({
      where: {
        monitorId,
      },
      orderBy: {
        startedAt: "desc",
      },
      take: limit,
      ...incidentWithMonitorArgs,
    });
  }

  async findLatestByMonitorId(monitorId: string): Promise<IncidentWithMonitor | null> {
    return this.prisma.incident.findFirst({
      where: {
        monitorId,
      },
      orderBy: {
        startedAt: "desc",
      },
      ...incidentWithMonitorArgs,
    });
  }
}
