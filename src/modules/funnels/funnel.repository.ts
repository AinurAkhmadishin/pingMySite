import { FunnelSessionKind, FunnelSessionStatus, Prisma, PrismaClient } from "@prisma/client";

function toNullableJson(payload?: Record<string, unknown> | null) {
  if (payload === undefined || payload === null) {
    return Prisma.DbNull;
  }

  return payload as Prisma.InputJsonValue;
}

export class FunnelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findLatestActiveSession(userId: string, kind: FunnelSessionKind) {
    return this.prisma.funnelSession.findFirst({
      where: {
        userId,
        kind,
        status: FunnelSessionStatus.ACTIVE,
      },
      orderBy: {
        lastEventAt: "desc",
      },
    });
  }

  async findSessionById(sessionId: string) {
    return this.prisma.funnelSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  async startSession(input: {
    userId: string;
    kind: FunnelSessionKind;
    stepKey: string;
    stepLabel: string;
    payload?: Record<string, unknown> | null;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.funnelSession.updateMany({
        where: {
          userId: input.userId,
          kind: input.kind,
          status: FunnelSessionStatus.ACTIVE,
        },
        data: {
          status: FunnelSessionStatus.ABANDONED,
          completedAt: now,
          lastEventAt: now,
        },
      });

      const session = await tx.funnelSession.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          status: FunnelSessionStatus.ACTIVE,
          currentStepKey: input.stepKey,
          currentStepLabel: input.stepLabel,
          lastEventPayload: toNullableJson(input.payload),
          startedAt: now,
          lastEventAt: now,
        },
      });

      await tx.funnelEvent.create({
        data: {
          sessionId: session.id,
          userId: input.userId,
          stepKey: input.stepKey,
          stepLabel: input.stepLabel,
          payload: toNullableJson(input.payload),
          createdAt: now,
        },
      });

      return session;
    });
  }

  async setCurrentStep(input: {
    sessionId: string;
    userId: string;
    stepKey: string;
    stepLabel: string;
    payload?: Record<string, unknown> | null;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.funnelEvent.create({
        data: {
          sessionId: input.sessionId,
          userId: input.userId,
          stepKey: input.stepKey,
          stepLabel: input.stepLabel,
          payload: toNullableJson(input.payload),
          createdAt: now,
        },
      });

      return tx.funnelSession.update({
        where: {
          id: input.sessionId,
        },
        data: {
          currentStepKey: input.stepKey,
          currentStepLabel: input.stepLabel,
          lastEventPayload: toNullableJson(input.payload),
          lastEventAt: now,
        },
      });
    });
  }

  async appendEvent(input: {
    sessionId: string;
    userId: string;
    stepKey: string;
    stepLabel: string;
    payload?: Record<string, unknown> | null;
  }) {
    return this.prisma.funnelEvent.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        stepKey: input.stepKey,
        stepLabel: input.stepLabel,
        payload: toNullableJson(input.payload),
      },
    });
  }

  async finishSession(input: {
    sessionId: string;
    userId: string;
    status: FunnelSessionStatus;
    stepKey: string;
    stepLabel: string;
    payload?: Record<string, unknown> | null;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.funnelEvent.create({
        data: {
          sessionId: input.sessionId,
          userId: input.userId,
          stepKey: input.stepKey,
          stepLabel: input.stepLabel,
          payload: toNullableJson(input.payload),
          createdAt: now,
        },
      });

      return tx.funnelSession.update({
        where: {
          id: input.sessionId,
        },
        data: {
          status: input.status,
          currentStepKey: input.stepKey,
          currentStepLabel: input.stepLabel,
          lastEventPayload: toNullableJson(input.payload),
          lastEventAt: now,
          completedAt: now,
        },
      });
    });
  }
}
