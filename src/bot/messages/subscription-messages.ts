import { UserSubscriptionStatus } from "@prisma/client";

import { env } from "../../config/env";
import { formatDateTime } from "../../lib/date-time";
import { UserSubscriptionWithUser } from "../../modules/subscriptions/subscription.repository";

function formatSubscriptionStatus(status: UserSubscriptionStatus): string {
  switch (status) {
    case UserSubscriptionStatus.ACTIVE:
      return "активна";
    case UserSubscriptionStatus.CANCELED:
      return "отключена, действует до конца периода";
    case UserSubscriptionStatus.EXPIRED:
      return "истекла";
    default:
      return status;
  }
}

function formatPlanLabel(planKey: string): string {
  if (planKey === "sub-30d" || planKey === "sub-3m") {
    return "Подписка 30 дней";
  }

  return planKey;
}

function buildPlanComparison(amountStars: number): string[] {
  return [
    "Доступные тарифы:",
    `1. Пробный доступ на 14 дней — до ${env.FREE_MONITOR_LIMIT} монитор(ов), интервалы от ${env.FREE_MIN_INTERVAL_MINUTES} мин`,
    `2. Подписка на 30 дней — ${amountStars} Stars, до ${env.SUBSCRIPTION_MONITOR_LIMIT} монитор(ов), интервалы от 1 мин`,
  ];
}

export function buildSubscriptionStatusMessage(
  subscription: UserSubscriptionWithUser | null,
  timeZone: string,
  amountStars: number,
): string {
  if (!subscription) {
    return [
      "Активной платной подписки пока нет.",
      ...buildPlanComparison(amountStars),
    ].join("\n");
  }

  return [
    `Статус подписки: ${formatSubscriptionStatus(subscription.status)}`,
    `Тариф: ${formatPlanLabel(subscription.planKey)}`,
    `Действует до: ${formatDateTime(subscription.currentPeriodEnd, timeZone)}`,
    `Стоимость: ${subscription.amountStars} Stars`,
    subscription.cancelAtPeriodEnd ? "Автопродление отключено." : "Автопродление включено.",
    "",
    ...buildPlanComparison(amountStars),
  ].join("\n");
}

export function buildSubscriptionCheckoutMessage(amountStars: number): string {
  return [
    "Для платного мониторинга нужна активная подписка Telegram Stars.",
    `Оплатите 30 дней за ${amountStars} Stars.`,
    `С подпиской доступны интервалы от 1 мин и до ${env.SUBSCRIPTION_MONITOR_LIMIT} монитор(ов).`,
    "После успешной оплаты бот сам активирует подписку и завершит создание монитора.",
  ].join("\n");
}

export function buildSubscriptionActivatedMessage(
  subscription: UserSubscriptionWithUser,
  timeZone: string,
  monitorName?: string,
): string {
  return [
    monitorName ? `Подписка активирована, монитор "${monitorName}" создан.` : "Подписка активирована.",
    `Доступ открыт до: ${formatDateTime(subscription.currentPeriodEnd, timeZone)}`,
  ].join("\n");
}

export function buildSubscriptionRenewedMessage(subscription: UserSubscriptionWithUser, timeZone: string): string {
  return [
    "Подписка продлена.",
    `Новый срок действия: ${formatDateTime(subscription.currentPeriodEnd, timeZone)}`,
  ].join("\n");
}

export function buildTermsMessage(): string {
  return [
    "Условия оплаты:",
    `1. Пробный период для сайта доступен на 14 дней и ограничен ${env.FREE_MONITOR_LIMIT} монитор(ами).`,
    `2. На бесплатном доступе доступны интервалы от ${env.FREE_MIN_INTERVAL_MINUTES} мин.`,
    `3. Платный тариф работает как подписка на 30 дней через Telegram Stars и позволяет до ${env.SUBSCRIPTION_MONITOR_LIMIT} монитор(ов).`,
    "4. Автопродление можно отключить в Telegram в настройках подписок.",
    "5. Мониторинг относится к цифровым услугам, физическая доставка не требуется.",
  ].join("\n");
}

export function buildPaymentSupportMessage(): string {
  return [
    "Поддержка по оплате:",
    "Если платеж не прошел или доступ не активировался, напишите администратору проекта или откройте поддержку по ссылке ниже.",
  ].join("\n");
}
