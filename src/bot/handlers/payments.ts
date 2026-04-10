import { MonitorTermKind } from "@prisma/client";
import { Telegraf } from "telegraf";

import { AppServices } from "../../app/services";
import { ADD_MONITOR_FUNNEL_STEPS } from "../../modules/funnels/funnel.constants";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { mainMenuKeyboard } from "../keyboards/main-menu";
import {
  buildSubscriptionActivatedMessage,
  buildSubscriptionRenewedMessage,
} from "../messages/subscription-messages";

export function registerPaymentHandlers(bot: Telegraf<BotContext>, services: AppServices): void {
  bot.on("pre_checkout_query", async (ctx) => {
    const currentUser = getCurrentUserOrThrow(ctx);
    const validation = await services.subscriptionService.validatePreCheckout({
      userId: currentUser.id,
      invoicePayload: ctx.preCheckoutQuery.invoice_payload,
      currency: ctx.preCheckoutQuery.currency,
      totalAmount: ctx.preCheckoutQuery.total_amount,
    });

    await ctx.answerPreCheckoutQuery(validation.ok, validation.errorMessage);
  });

  bot.on("message", async (ctx, next) => {
    if (!("successful_payment" in ctx.message)) {
      return next();
    }

    const currentUser = getCurrentUserOrThrow(ctx);
    const payment = services.subscriptionService.parseSuccessfulPayment(
      (ctx.message as { successful_payment: unknown }).successful_payment,
    );
    const activation = await services.subscriptionService.activateSubscriptionFromPayment({
      userId: currentUser.id,
      payment,
    });

    if (activation.alreadyProcessed) {
      return;
    }

    await services.subscriptionService.syncSubscriptionMonitorAccess(currentUser.id, activation.subscription.currentPeriodEnd);

    let createdMonitorName: string | undefined;

    if (activation.checkout && activation.monitorDraft && !activation.checkout.createdMonitorId) {
      try {
        const monitor = await services.monitorService.createMonitor({
          userId: currentUser.id,
          name: activation.monitorDraft.name,
          url: activation.monitorDraft.url,
          termKind: MonitorTermKind.SUBSCRIPTION,
          intervalMinutes: activation.monitorDraft.intervalMinutes,
          timeoutMs: activation.monitorDraft.timeoutMs,
          requiredText: activation.monitorDraft.requiredText,
          checkSsl: activation.monitorDraft.checkSsl,
          checkJson: activation.monitorDraft.checkJson,
          jsonRules: activation.monitorDraft.jsonRules,
          failureThreshold: activation.monitorDraft.failureThreshold,
          recoveryThreshold: activation.monitorDraft.recoveryThreshold,
        });

        createdMonitorName = monitor.name;

        await services.subscriptionService.markCheckoutMonitorCreated(
          activation.checkout.id,
          activation.paymentId,
          monitor.id,
        );
        await services.funnelService.completeAddMonitorSession(
          activation.checkout.funnelSessionId ?? undefined,
          currentUser.id,
          ADD_MONITOR_FUNNEL_STEPS.monitorCreated,
          {
            monitorId: monitor.id,
            paymentId: activation.paymentId,
            termKind: "subscription",
          },
        );
      } catch (error) {
        await services.funnelService.stopAddMonitorSession(
          activation.checkout.funnelSessionId ?? undefined,
          currentUser.id,
          ADD_MONITOR_FUNNEL_STEPS.monitorCreationFailed,
          {
            paymentId: activation.paymentId,
            errorMessage: error instanceof Error ? error.message : "Неизвестная ошибка",
          },
        );
        await ctx.reply(
          `Подписка активирована, но монитор не удалось создать автоматически. ${
            error instanceof Error ? error.message : ""
          }`.trim(),
          mainMenuKeyboard(),
        );
        return;
      }
    }

    const replyMessage = payment.isRecurring
      ? buildSubscriptionRenewedMessage(activation.subscription, currentUser.timezone)
      : buildSubscriptionActivatedMessage(activation.subscription, currentUser.timezone, createdMonitorName);

    await ctx.reply(replyMessage, mainMenuKeyboard());
  });
}
