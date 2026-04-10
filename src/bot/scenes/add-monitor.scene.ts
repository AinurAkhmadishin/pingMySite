import { AppServices } from "../../app/services";
import {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
  MONITOR_TERM_PLANS,
  MonitorTermKey,
} from "../../config/constants";
import { env } from "../../config/env";
import { addDays, formatDateTime } from "../../lib/date-time";
import { normalizeUrl } from "../../lib/url";
import { parseJsonRulesText } from "../../modules/checks/json-validator";
import { ADD_MONITOR_FUNNEL_STEPS, AddMonitorFunnelStep } from "../../modules/funnels/funnel.constants";
import { SubscriptionMonitorDraft } from "../../modules/subscriptions/subscription.service";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { intervalKeyboard, monitorTermKeyboard, sensitivityKeyboard, yesNoKeyboard } from "../keyboards/intervals";
import { mainMenuKeyboard } from "../keyboards/main-menu";
import { subscriptionCheckoutKeyboard } from "../keyboards/subscription";
import { buildSubscriptionCheckoutMessage } from "../messages/subscription-messages";

function resolveMonitorTerm(termKey: MonitorTermKey, from = new Date()) {
  const plan = MONITOR_TERM_PLANS.find((item) => item.key === termKey);

  if (!plan) {
    throw new Error("Неизвестный тариф мониторинга.");
  }

  return {
    plan,
    endsAt: "days" in plan ? addDays(from, plan.days) : null,
  };
}

function buildSubscriptionDraft(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): SubscriptionMonitorDraft {
  return {
    name: flow.draft.name ?? "Без имени",
    url: flow.draft.url ?? "",
    intervalMinutes: flow.draft.intervalMinutes ?? 5,
    timeoutMs: env.DEFAULT_TIMEOUT_MS,
    requiredText: flow.draft.requiredText ?? null,
    checkSsl: flow.draft.checkSsl,
    checkJson: flow.draft.checkJson,
    jsonRules: flow.draft.jsonRules ?? null,
    failureThreshold: flow.draft.failureThreshold,
    recoveryThreshold: DEFAULT_RECOVERY_THRESHOLD,
  };
}

async function stopAddMonitorFlow(
  ctx: BotContext,
  services: AppServices,
  userId: string,
  funnelSessionId: string | undefined,
  message: string,
  step: AddMonitorFunnelStep = ADD_MONITOR_FUNNEL_STEPS.monitorCreationFailed,
  payload?: Record<string, unknown>,
): Promise<void> {
  ctx.session.flow = undefined;
  await services.funnelService.stopAddMonitorSession(funnelSessionId, userId, step, payload);
  await ctx.reply(message, mainMenuKeyboard());
}

export async function startAddMonitorFlow(ctx: BotContext, services: AppServices): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const funnelSession = await services.funnelService.startAddMonitorSession(currentUser.id);

  ctx.session.flow = {
    kind: "add",
    funnelSessionId: funnelSession.id,
    step: "url",
    draft: {
      checkJson: false,
      checkSsl: false,
      failureThreshold: DEFAULT_FAILURE_THRESHOLD,
    },
  };

  await ctx.reply("Введите URL сайта или API, который нужно мониторить.");
}

export async function handleAddMonitorText(ctx: BotContext, services: AppServices): Promise<boolean> {
  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "add" || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const currentUser = getCurrentUserOrThrow(ctx);
  const text = ctx.message.text.trim();

  if (flow.step === "url") {
    try {
      const normalizedUrl = normalizeUrl(text);
      const existingMonitor = await services.monitorService.findExistingMonitorByUrl(currentUser.id, normalizedUrl);

      if (existingMonitor) {
        await stopAddMonitorFlow(
          ctx,
          services,
          currentUser.id,
          flow.funnelSessionId,
          "Этот URL уже добавлен в мониторинг. Опрос остановлен.",
          ADD_MONITOR_FUNNEL_STEPS.duplicateUrlBlocked,
          {
            url: normalizedUrl,
          },
        );
        return true;
      }

      flow.draft.url = normalizedUrl;
      flow.step = "name";
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingName,
        {
          url: normalizedUrl,
        },
      );
      await ctx.reply("Введите отображаемое имя проекта.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Введите корректный адрес сайта и попробуйте снова.";

      await stopAddMonitorFlow(
        ctx,
        services,
        currentUser.id,
        flow.funnelSessionId,
        `Адрес сайта невалидный. Опрос остановлен. ${reason}`.trim(),
        ADD_MONITOR_FUNNEL_STEPS.invalidUrl,
        {
          rawUrl: text,
          reason,
        },
      );
    }

    return true;
  }

  if (flow.step === "name") {
    flow.draft.name = text;
    flow.step = "interval";
    await services.funnelService.setAddMonitorStep(
      flow.funnelSessionId,
      currentUser.id,
      ADD_MONITOR_FUNNEL_STEPS.awaitingInterval,
      {
        url: flow.draft.url ?? null,
        name: text,
      },
    );
    await ctx.reply("Выберите интервал мониторинга.", intervalKeyboard("add-interval"));
    return true;
  }

  if (flow.step === "contentText") {
    flow.draft.requiredText = text;
    flow.step = "sslToggle";
    await services.funnelService.setAddMonitorStep(
      flow.funnelSessionId,
      currentUser.id,
      ADD_MONITOR_FUNNEL_STEPS.awaitingSslToggle,
      {
        requiredText: text,
      },
    );
    await ctx.reply("Включить SSL-проверку?", yesNoKeyboard("add-ssl:yes", "add-ssl:no"));
    return true;
  }

  if (flow.step === "jsonRules") {
    try {
      flow.draft.jsonRules = parseJsonRulesText(text);
      flow.step = "sensitivity";
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingSensitivity,
        {
          jsonRulesCount: flow.draft.jsonRules.length,
        },
      );
      await ctx.reply("Выберите чувствительность оповещений.", sensitivityKeyboard("add-sensitivity"));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Неверный формат JSON-правил.";

      await services.funnelService.appendAddMonitorEvent(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.invalidJsonRules,
        {
          input: text,
          errorMessage,
        },
      );

      await ctx.reply(
        `Не удалось распознать JSON-правила. Используйте формат "status = ok" или "data.version exists". ${errorMessage}`.trim(),
      );
    }

    return true;
  }

  return false;
}

export async function handleAddMonitorCallback(ctx: BotContext, services: AppServices): Promise<boolean> {
  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "add" || !ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    return false;
  }

  const currentUser = getCurrentUserOrThrow(ctx);
  const data = ctx.callbackQuery.data;

  if (flow.step === "interval" && data.startsWith("add-interval:")) {
    flow.draft.intervalMinutes = Number(data.split(":")[1]);
    flow.step = "contentToggle";
    await ctx.answerCbQuery();
    await services.funnelService.setAddMonitorStep(
      flow.funnelSessionId,
      currentUser.id,
      ADD_MONITOR_FUNNEL_STEPS.awaitingContentToggle,
      {
        intervalMinutes: flow.draft.intervalMinutes,
      },
    );
    await ctx.reply(
      "Нужна проверка содержимого страницы по обязательному тексту?",
      yesNoKeyboard("add-content:yes", "add-content:no"),
    );
    return true;
  }

  if (flow.step === "contentToggle" && data.startsWith("add-content:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.requiredText = enabled ? undefined : null;
    flow.step = enabled ? "contentText" : "sslToggle";
    await ctx.answerCbQuery();

    if (enabled) {
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingContentText,
        {
          contentCheckEnabled: true,
        },
      );
      await ctx.reply("Введите текст, который обязательно должен присутствовать в ответе.");
    } else {
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingSslToggle,
        {
          contentCheckEnabled: false,
        },
      );
      await ctx.reply("Включить SSL-проверку?", yesNoKeyboard("add-ssl:yes", "add-ssl:no"));
    }

    return true;
  }

  if (flow.step === "sslToggle" && data.startsWith("add-ssl:")) {
    flow.draft.checkSsl = data.endsWith(":yes");
    flow.step = "jsonToggle";
    await ctx.answerCbQuery();
    await services.funnelService.setAddMonitorStep(
      flow.funnelSessionId,
      currentUser.id,
      ADD_MONITOR_FUNNEL_STEPS.awaitingJsonToggle,
      {
        checkSsl: flow.draft.checkSsl,
      },
    );
    await ctx.reply("Включить JSON-валидацию ответа?", yesNoKeyboard("add-json:yes", "add-json:no"));
    return true;
  }

  if (flow.step === "jsonToggle" && data.startsWith("add-json:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.checkJson = enabled;
    flow.step = enabled ? "jsonRules" : "sensitivity";
    await ctx.answerCbQuery();

    if (enabled) {
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingJsonRules,
        {
          checkJson: true,
        },
      );
      await ctx.reply('Введите JSON-правила, каждое с новой строки. Пример:\nstatus = ok\ndata.version exists');
    } else {
      await services.funnelService.setAddMonitorStep(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.awaitingSensitivity,
        {
          checkJson: false,
        },
      );
      await ctx.reply("Выберите чувствительность оповещений.", sensitivityKeyboard("add-sensitivity"));
    }

    return true;
  }

  if (flow.step === "sensitivity" && data.startsWith("add-sensitivity:")) {
    flow.draft.failureThreshold = Number(data.split(":")[1]);
    flow.step = "duration";
    await ctx.answerCbQuery();
    await services.funnelService.setAddMonitorStep(
      flow.funnelSessionId,
      currentUser.id,
      ADD_MONITOR_FUNNEL_STEPS.awaitingTermSelection,
      {
        failureThreshold: flow.draft.failureThreshold,
      },
    );
    await ctx.reply("Выберите тариф мониторинга.", monitorTermKeyboard("add-duration"));
    return true;
  }

  if (flow.step === "duration" && data.startsWith("add-duration:")) {
    const termKey = data.split(":")[1] as MonitorTermKey;

    await ctx.answerCbQuery();

    try {
      const { plan, endsAt } = resolveMonitorTerm(termKey);
      flow.draft.termKey = termKey;

      if (plan.kind === "subscription") {
        await services.funnelService.appendAddMonitorEvent(
          flow.funnelSessionId,
          currentUser.id,
          ADD_MONITOR_FUNNEL_STEPS.subscriptionSelected,
          {
            termKey,
          },
        );

        const activeSubscription = await services.subscriptionService.getActiveSubscriptionForUser(currentUser.id);

        if (!activeSubscription) {
          const checkout = await services.subscriptionService.createSubscriptionCheckout({
            userId: currentUser.id,
            chatId: String(ctx.chat?.id ?? currentUser.telegramId),
            funnelSessionId: flow.funnelSessionId,
            monitorDraft: buildSubscriptionDraft(flow),
          });

          ctx.session.flow = undefined;

          await ctx.reply(
            buildSubscriptionCheckoutMessage(checkout.amountStars),
            subscriptionCheckoutKeyboard(checkout.paymentUrl),
          );

          return true;
        }
      } else {
        await services.funnelService.appendAddMonitorEvent(
          flow.funnelSessionId,
          currentUser.id,
          ADD_MONITOR_FUNNEL_STEPS.trialSelected,
          {
            termKey,
          },
        );
      }

      const monitor = await services.monitorService.createMonitor({
        userId: currentUser.id,
        name: flow.draft.name ?? "Без имени",
        url: flow.draft.url ?? "",
        termKind: plan.kind === "trial" ? "TRIAL" : "SUBSCRIPTION",
        intervalMinutes: flow.draft.intervalMinutes ?? 5,
        timeoutMs: env.DEFAULT_TIMEOUT_MS,
        requiredText: flow.draft.requiredText ?? null,
        checkSsl: flow.draft.checkSsl,
        checkJson: flow.draft.checkJson,
        jsonRules: flow.draft.jsonRules ?? null,
        endsAt,
        failureThreshold: flow.draft.failureThreshold,
      });

      ctx.session.flow = undefined;
      await services.funnelService.completeAddMonitorSession(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.monitorCreated,
        {
          monitorId: monitor.id,
          termKey,
          termKind: plan.kind,
          endsAt: (monitor.endsAt ?? endsAt)?.toISOString() ?? null,
        },
      );

      await ctx.reply(
        [
          "Монитор сохранен.",
          `Проект: ${monitor.name}`,
          `Тариф: ${plan.label}`,
          `URL: ${monitor.url}`,
          `Интервал: ${monitor.intervalMinutes} мин`,
          `Мониторинг до: ${formatDateTime(monitor.endsAt ?? endsAt ?? new Date(), currentUser.timezone)}`,
          `SSL: ${monitor.checkSsl ? "да" : "нет"}`,
          `JSON: ${monitor.checkJson ? "да" : "нет"}`,
        ].join("\n"),
        mainMenuKeyboard(),
      );
    } catch (error) {
      await services.funnelService.appendAddMonitorEvent(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.monitorCreationFailed,
        {
          termKey,
          errorMessage: error instanceof Error ? error.message : "Неизвестная ошибка",
        },
      );

      await ctx.reply(`Не удалось сохранить монитор. ${error instanceof Error ? error.message : ""}`.trim());
    }

    return true;
  }

  return false;
}
