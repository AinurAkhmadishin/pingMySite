import {
  Prisma,
  PrismaClient,
  SubscriptionCheckoutStatus,
  UserSubscriptionStatus,
} from "@prisma/client";

export const userSubscriptionArgs = Prisma.validator<Prisma.UserSubscriptionDefaultArgs>()({
  include: {
    user: true,
  },
});

export const subscriptionCheckoutArgs = Prisma.validator<Prisma.SubscriptionCheckoutDefaultArgs>()({
  include: {
    user: true,
  },
});

export type UserSubscriptionWithUser = Prisma.UserSubscriptionGetPayload<typeof userSubscriptionArgs>;
export type SubscriptionCheckoutWithUser = Prisma.SubscriptionCheckoutGetPayload<typeof subscriptionCheckoutArgs>;

export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSubscriptionByUserId(userId: string): Promise<UserSubscriptionWithUser | null> {
    return this.prisma.userSubscription.findUnique({
      where: {
        userId,
      },
      ...userSubscriptionArgs,
    });
  }

  async findActiveSubscriptionByUserId(userId: string, now = new Date()): Promise<UserSubscriptionWithUser | null> {
    return this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: UserSubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          gt: now,
        },
      },
      ...userSubscriptionArgs,
    });
  }

  async createCheckout(data: Prisma.SubscriptionCheckoutUncheckedCreateInput): Promise<SubscriptionCheckoutWithUser> {
    return this.prisma.subscriptionCheckout.create({
      data,
      ...subscriptionCheckoutArgs,
    });
  }

  async findCheckoutByInvoicePayload(invoicePayload: string): Promise<SubscriptionCheckoutWithUser | null> {
    return this.prisma.subscriptionCheckout.findUnique({
      where: {
        invoicePayload,
      },
      ...subscriptionCheckoutArgs,
    });
  }

  async updateCheckout(
    checkoutId: string,
    data: Prisma.SubscriptionCheckoutUncheckedUpdateInput,
  ): Promise<SubscriptionCheckoutWithUser> {
    return this.prisma.subscriptionCheckout.update({
      where: {
        id: checkoutId,
      },
      data,
      ...subscriptionCheckoutArgs,
    });
  }

  async expireStaleCheckouts(now: Date): Promise<void> {
    await this.prisma.subscriptionCheckout.updateMany({
      where: {
        status: SubscriptionCheckoutStatus.PENDING,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: SubscriptionCheckoutStatus.EXPIRED,
      },
    });
  }

  async upsertSubscription(data: {
    userId: string;
    status: UserSubscriptionStatus;
    planKey: string;
    amountStars: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date | null;
    lastPaymentAt?: Date | null;
    lastInvoicePayload?: string | null;
    lastTelegramPaymentChargeId?: string | null;
    lastProviderPaymentChargeId?: string | null;
  }): Promise<UserSubscriptionWithUser> {
    return this.prisma.userSubscription.upsert({
      where: {
        userId: data.userId,
      },
      create: {
        userId: data.userId,
        status: data.status,
        planKey: data.planKey,
        amountStars: data.amountStars,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        canceledAt: data.canceledAt ?? null,
        lastPaymentAt: data.lastPaymentAt ?? null,
        lastInvoicePayload: data.lastInvoicePayload ?? null,
        lastTelegramPaymentChargeId: data.lastTelegramPaymentChargeId ?? null,
        lastProviderPaymentChargeId: data.lastProviderPaymentChargeId ?? null,
      },
      update: {
        status: data.status,
        planKey: data.planKey,
        amountStars: data.amountStars,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        canceledAt: data.canceledAt ?? null,
        lastPaymentAt: data.lastPaymentAt ?? null,
        lastInvoicePayload: data.lastInvoicePayload ?? null,
        lastTelegramPaymentChargeId: data.lastTelegramPaymentChargeId ?? null,
        lastProviderPaymentChargeId: data.lastProviderPaymentChargeId ?? null,
      },
      ...userSubscriptionArgs,
    });
  }

  async updateSubscription(
    subscriptionId: string,
    data: Prisma.UserSubscriptionUncheckedUpdateInput,
  ): Promise<UserSubscriptionWithUser> {
    return this.prisma.userSubscription.update({
      where: {
        id: subscriptionId,
      },
      data,
      ...userSubscriptionArgs,
    });
  }

  async findPaymentByTelegramChargeId(telegramPaymentChargeId: string) {
    return this.prisma.subscriptionPayment.findUnique({
      where: {
        telegramPaymentChargeId,
      },
    });
  }

  async createPayment(data: Prisma.SubscriptionPaymentUncheckedCreateInput) {
    return this.prisma.subscriptionPayment.create({
      data,
    });
  }

  async updatePayment(paymentId: string, data: Prisma.SubscriptionPaymentUncheckedUpdateInput) {
    return this.prisma.subscriptionPayment.update({
      where: {
        id: paymentId,
      },
      data,
    });
  }
}
