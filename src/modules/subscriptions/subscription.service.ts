import { randomUUID } from "node:crypto";

import { Prisma, SubscriptionCheckoutStatus, UserSubscriptionStatus } from "@prisma/client";
import { Telegram } from "telegraf";
import { z } from "zod";

import { STARS_SUBSCRIPTION_PERIOD_SECONDS } from "../../config/constants";
import { env } from "../../config/env";
import { addDays } from "../../lib/date-time";
import { ADD_MONITOR_FUNNEL_STEPS } from "../funnels/funnel.constants";
import { FunnelService } from "../funnels/funnel.service";
import { JsonRule } from "../checks/types";
import { jsonRulesSchema } from "../monitors/monitor.schemas";
import { MonitorRepository } from "../monitors/monitor.repository";
import {
  SubscriptionCheckoutWithUser,
  SubscriptionRepository,
  UserSubscriptionWithUser,
} from "./subscription.repository";

export interface SubscriptionMonitorDraft {
  name: string;
  url: string;
  intervalMinutes: number;
  timeoutMs: number;
  requiredText: string | null;
  checkSsl: boolean;
  checkJson: boolean;
  jsonRules: JsonRule[] | null;
  failureThreshold: number;
  recoveryThreshold: number;
}

export interface SubscriptionSchedulerPort {
  scheduleMonitor(monitorId: string, intervalMinutes: number): Promise<void>;
}

export interface CreateSubscriptionCheckoutInput {
  userId: string;
  chatId: string;
  funnelSessionId?: string;
  monitorDraft?: SubscriptionMonitorDraft | null;
}

export interface CreateSubscriptionCheckoutResult {
  checkout: SubscriptionCheckoutWithUser;
  paymentUrl: string;
  amountStars: number;
}

export interface PreCheckoutValidationInput {
  userId: string;
  invoicePayload: string;
  currency: string;
  totalAmount: number;
}

export interface StarsSuccessfulPayment {
  currency: string;
  totalAmount: number;
  invoicePayload: string;
  telegramPaymentChargeId: string;
  providerPaymentChargeId: string;
  isRecurring: boolean;
  isFirstRecurring: boolean;
  subscriptionExpirationDate: Date | null;
}

export interface ActivatedSubscriptionResult {
  subscription: UserSubscriptionWithUser;
  checkout: SubscriptionCheckoutWithUser | null;
  monitorDraft: SubscriptionMonitorDraft | null;
  paymentId: string | null;
  alreadyProcessed: boolean;
}

const subscriptionMonitorDraftSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  intervalMinutes: z.number().int().min(1),
  timeoutMs: z.number().int().min(1000),
  requiredText: z.string().nullable(),
  checkSsl: z.boolean(),
  checkJson: z.boolean(),
  jsonRules: jsonRulesSchema.nullable(),
  failureThreshold: z.number().int().min(2).max(5),
  recoveryThreshold: z.number().int().min(1).max(3),
});

const starsSuccessfulPaymentSchema = z.object({
  currency: z.string().min(1),
  total_amount: z.number().int().positive(),
  invoice_payload: z.string().min(1),
  telegram_payment_charge_id: z.string().min(1),
  provider_payment_charge_id: z.string().optional().default(""),
  is_recurring: z.boolean().optional().default(false),
  is_first_recurring: z.boolean().optional().default(false),
  subscription_expiration_date: z.number().int().optional().nullable(),
});

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly monitorRepository: MonitorRepository,
    private readonly scheduler: SubscriptionSchedulerPort,
    private readonly telegram: Telegram,
    private readonly funnelService: FunnelService,
  ) {}

  async getSubscriptionForUser(userId: string): Promise<UserSubscriptionWithUser | null> {
    const subscription = await this.subscriptionRepository.findSubscriptionByUserId(userId);

    if (!subscription) {
      return null;
    }

    if (subscription.status === UserSubscriptionStatus.ACTIVE && subscription.currentPeriodEnd <= new Date()) {
      return this.subscriptionRepository.updateSubscription(subscription.id, {
        status: UserSubscriptionStatus.EXPIRED,
      });
    }

    return subscription;
  }

  async getActiveSubscriptionForUser(userId: string): Promise<UserSubscriptionWithUser | null> {
    const subscription = await this.getSubscriptionForUser(userId);

    if (!subscription) {
      return null;
    }

    if (subscription.status !== UserSubscriptionStatus.ACTIVE) {
      return null;
    }

    if (subscription.currentPeriodEnd <= new Date()) {
      return null;
    }

    return subscription;
  }

  async createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput): Promise<CreateSubscriptionCheckoutResult> {
    await this.subscriptionRepository.expireStaleCheckouts(new Date());

    const invoicePayload = `stars-sub:${randomUUID()}`;
    const checkout = await this.subscriptionRepository.createCheckout({
      userId: input.userId,
      funnelSessionId: input.funnelSessionId,
      chatId: input.chatId,
      invoicePayload,
      status: SubscriptionCheckoutStatus.PENDING,
      planKey: "sub-30d",
      amountStars: env.TELEGRAM_STARS_MONTHLY_PRICE,
      monitorDraft: input.monitorDraft ? ((input.monitorDraft as unknown) as Prisma.InputJsonValue) : undefined,
      expiresAt: addDays(new Date(), 1),
    });

    await this.funnelService.setAddMonitorStep(
      input.funnelSessionId,
      input.userId,
      ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment,
      {
        planKey: checkout.planKey,
        amountStars: checkout.amountStars,
        invoicePayload,
        hasMonitorDraft: Boolean(input.monitorDraft),
      },
    );

    const paymentUrl = (await this.telegram.callApi("createInvoiceLink", {
      title: "Ping My Site Pro",
      description: "Подписка на 30 дней с оплатой через Telegram Stars.",
      payload: invoicePayload,
      provider_token: "",
      currency: "XTR",
      prices: [
        {
          label: "Подписка на 30 дней",
          amount: env.TELEGRAM_STARS_MONTHLY_PRICE,
        },
      ],
      subscription_period: STARS_SUBSCRIPTION_PERIOD_SECONDS,
    } as never)) as string;

    return {
      checkout,
      paymentUrl,
      amountStars: env.TELEGRAM_STARS_MONTHLY_PRICE,
    };
  }

  async validatePreCheckout(input: PreCheckoutValidationInput): Promise<{ ok: boolean; errorMessage?: string }> {
    await this.subscriptionRepository.expireStaleCheckouts(new Date());

    if (input.currency !== "XTR") {
      return {
        ok: false,
        errorMessage: "Поддерживается только оплата в Telegram Stars.",
      };
    }

    if (input.totalAmount !== env.TELEGRAM_STARS_MONTHLY_PRICE) {
      return {
        ok: false,
        errorMessage: "Сумма оплаты больше не актуальна. Откройте новый счет.",
      };
    }

    const checkout = await this.subscriptionRepository.findCheckoutByInvoicePayload(input.invoicePayload);

    if (!checkout || checkout.userId !== input.userId) {
      return {
        ok: false,
        errorMessage: "Счет на оплату не найден. Попробуйте создать его заново.",
      };
    }

    if (checkout.status !== SubscriptionCheckoutStatus.PENDING) {
      return {
        ok: false,
        errorMessage: "Этот счет уже обработан. Создайте новый, если нужно.",
      };
    }

    if (checkout.expiresAt && checkout.expiresAt <= new Date()) {
      await this.subscriptionRepository.updateCheckout(checkout.id, {
        status: SubscriptionCheckoutStatus.EXPIRED,
      });

      return {
        ok: false,
        errorMessage: "Счет истек. Создайте новый.",
      };
    }

    await this.funnelService.appendAddMonitorEvent(
      checkout.funnelSessionId ?? undefined,
      input.userId,
      ADD_MONITOR_FUNNEL_STEPS.subscriptionPreCheckoutApproved,
      {
        invoicePayload: input.invoicePayload,
        amountStars: input.totalAmount,
      },
    );

    return {
      ok: true,
    };
  }

  parseSuccessfulPayment(payment: unknown): StarsSuccessfulPayment {
    const parsed = starsSuccessfulPaymentSchema.parse(payment);

    return {
      currency: parsed.currency,
      totalAmount: parsed.total_amount,
      invoicePayload: parsed.invoice_payload,
      telegramPaymentChargeId: parsed.telegram_payment_charge_id,
      providerPaymentChargeId: parsed.provider_payment_charge_id,
      isRecurring: parsed.is_recurring,
      isFirstRecurring: parsed.is_first_recurring,
      subscriptionExpirationDate:
        parsed.subscription_expiration_date === null || parsed.subscription_expiration_date === undefined
          ? null
          : new Date(parsed.subscription_expiration_date * 1000),
    };
  }

  async activateSubscriptionFromPayment(input: {
    userId: string;
    payment: StarsSuccessfulPayment;
  }): Promise<ActivatedSubscriptionResult> {
    const existingPayment = await this.subscriptionRepository.findPaymentByTelegramChargeId(
      input.payment.telegramPaymentChargeId,
    );

    if (existingPayment) {
      const subscription = await this.getSubscriptionForUser(input.userId);

      if (!subscription) {
        throw new Error("Подписка не найдена после обработки платежа.");
      }

      return {
        subscription,
        checkout: await this.subscriptionRepository.findCheckoutByInvoicePayload(input.payment.invoicePayload),
        monitorDraft: null,
        paymentId: existingPayment.id,
        alreadyProcessed: true,
      };
    }

    if (input.payment.currency !== "XTR") {
      throw new Error("Ожидалась оплата в Telegram Stars.");
    }

    const checkout = await this.subscriptionRepository.findCheckoutByInvoicePayload(input.payment.invoicePayload);

    if (!checkout || checkout.userId !== input.userId) {
      throw new Error("Счет на оплату не найден.");
    }

    const now = new Date();
    const currentSubscription = await this.getSubscriptionForUser(input.userId);
    const currentPeriodEnd =
      input.payment.subscriptionExpirationDate ??
      new Date(now.getTime() + STARS_SUBSCRIPTION_PERIOD_SECONDS * 1000);
    const currentPeriodStart =
      currentSubscription && currentSubscription.currentPeriodEnd > now
        ? currentSubscription.currentPeriodEnd
        : now;

    const subscription = await this.subscriptionRepository.upsertSubscription({
      userId: input.userId,
      status: UserSubscriptionStatus.ACTIVE,
      planKey: "sub-30d",
      amountStars: input.payment.totalAmount,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      lastPaymentAt: now,
      lastInvoicePayload: input.payment.invoicePayload,
      lastTelegramPaymentChargeId: input.payment.telegramPaymentChargeId,
      lastProviderPaymentChargeId: input.payment.providerPaymentChargeId,
    });

    const paymentRecord = await this.subscriptionRepository.createPayment({
      userId: input.userId,
      userSubscriptionId: subscription.id,
      invoicePayload: input.payment.invoicePayload,
      currency: input.payment.currency,
      amountStars: input.payment.totalAmount,
      telegramPaymentChargeId: input.payment.telegramPaymentChargeId,
      providerPaymentChargeId: input.payment.providerPaymentChargeId || null,
      isRecurring: input.payment.isRecurring,
      isFirstRecurring: input.payment.isFirstRecurring,
      subscriptionExpiresAt: currentPeriodEnd,
    });

    let updatedCheckout = checkout;
    let monitorDraft: SubscriptionMonitorDraft | null = null;

    if (checkout.status === SubscriptionCheckoutStatus.PENDING) {
      updatedCheckout = await this.subscriptionRepository.updateCheckout(checkout.id, {
        status: SubscriptionCheckoutStatus.PAID,
        paidAt: now,
        telegramPaymentChargeId: input.payment.telegramPaymentChargeId,
        providerPaymentChargeId: input.payment.providerPaymentChargeId || null,
      });

      monitorDraft = this.parseMonitorDraft(updatedCheckout.monitorDraft);
    }

    await this.funnelService.appendAddMonitorEvent(
      updatedCheckout.funnelSessionId ?? undefined,
      input.userId,
      ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded,
      {
        invoicePayload: input.payment.invoicePayload,
        amountStars: input.payment.totalAmount,
        isRecurring: input.payment.isRecurring,
        subscriptionExpiresAt: currentPeriodEnd.toISOString(),
      },
    );

    return {
      subscription,
      checkout: updatedCheckout,
      monitorDraft,
      paymentId: paymentRecord.id,
      alreadyProcessed: false,
    };
  }

  async syncSubscriptionMonitorAccess(userId: string, currentPeriodEnd: Date): Promise<void> {
    await this.monitorRepository.syncSubscriptionMonitorAccess(userId, currentPeriodEnd);

    const schedules = await this.monitorRepository.listActiveSubscriptionMonitorSchedules(userId);

    for (const schedule of schedules) {
      await this.scheduler.scheduleMonitor(schedule.monitorId, schedule.intervalMinutes);
    }
  }

  async markCheckoutMonitorCreated(
    checkoutId: string,
    paymentId: string | null,
    monitorId: string,
  ): Promise<void> {
    await this.subscriptionRepository.updateCheckout(checkoutId, {
      createdMonitorId: monitorId,
    });

    if (paymentId) {
      await this.subscriptionRepository.updatePayment(paymentId, {
        createdMonitorId: monitorId,
      });
    }
  }

  private parseMonitorDraft(value: unknown): SubscriptionMonitorDraft | null {
    if (!value) {
      return null;
    }

    return subscriptionMonitorDraftSchema.parse(value);
  }
}
