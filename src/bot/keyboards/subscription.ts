import { Markup } from "telegraf";

import { env } from "../../config/env";

export function subscriptionCheckoutKeyboard(paymentUrl: string) {
  const buttons = [[Markup.button.url("Оплатить в Stars", paymentUrl)]];

  if (env.PAYMENTS_TERMS_URL) {
    buttons.push([Markup.button.url("Условия оплаты", env.PAYMENTS_TERMS_URL)]);
  }

  if (env.PAYMENTS_SUPPORT_URL) {
    buttons.push([Markup.button.url("Поддержка", env.PAYMENTS_SUPPORT_URL)]);
  }

  return Markup.inlineKeyboard(buttons);
}
