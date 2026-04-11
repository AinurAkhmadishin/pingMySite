import { AppServices } from "../../app/services";
import {
  ADD_MONITOR_PRESETS,
  AddMonitorPreset,
  AddMonitorPresetKey,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
  MONITOR_TERM_PLANS,
  MonitorTermKey,
  SUPPORTED_INTERVALS,
  SupportedInterval,
} from "../../config/constants";
import { env } from "../../config/env";
import { addDays, formatDateTime } from "../../lib/date-time";
import { normalizeUrl } from "../../lib/url";
import { parseJsonRulesText } from "../../modules/checks/json-validator";
import { AddMonitorFunnelStep, ADD_MONITOR_FUNNEL_STEPS } from "../../modules/funnels/funnel.constants";
import { SubscriptionMonitorDraft } from "../../modules/subscriptions/subscription.service";
import { AddMonitorDraft, AddMonitorFlow, BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import {
  addMonitorIntervalKeyboard,
  addMonitorPresetKeyboard,
  addMonitorResumeKeyboard,
  addMonitorSensitivityKeyboard,
  addMonitorTermKeyboard,
  addMonitorTextStepKeyboard,
  addMonitorYesNoKeyboard,
} from "../keyboards/add-monitor";
import { mainMenuKeyboard } from "../keyboards/main-menu";
import { subscriptionCheckoutKeyboard } from "../keyboards/subscription";
import { buildSubscriptionCheckoutMessage } from "../messages/subscription-messages";
import { offerDailySummaryOptIn } from "./settings.scene";

type AddMonitorStep = AddMonitorFlow["step"];

type AddMonitorSessionSnapshot = {
  step: AddMonitorStep;
  draft: AddMonitorDraft;
};

const STEP_TO_FUNNEL_STEP: Record<AddMonitorStep, AddMonitorFunnelStep> = {
  preset: ADD_MONITOR_FUNNEL_STEPS.awaitingPreset,
  url: ADD_MONITOR_FUNNEL_STEPS.awaitingUrl,
  name: ADD_MONITOR_FUNNEL_STEPS.awaitingName,
  interval: ADD_MONITOR_FUNNEL_STEPS.awaitingInterval,
  contentToggle: ADD_MONITOR_FUNNEL_STEPS.awaitingContentToggle,
  contentText: ADD_MONITOR_FUNNEL_STEPS.awaitingContentText,
  sslToggle: ADD_MONITOR_FUNNEL_STEPS.awaitingSslToggle,
  jsonToggle: ADD_MONITOR_FUNNEL_STEPS.awaitingJsonToggle,
  jsonRules: ADD_MONITOR_FUNNEL_STEPS.awaitingJsonRules,
  sensitivity: ADD_MONITOR_FUNNEL_STEPS.awaitingSensitivity,
  duration: ADD_MONITOR_FUNNEL_STEPS.awaitingTermSelection,
};

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

function resolvePreset(presetKey: AddMonitorPresetKey | undefined): AddMonitorPreset {
  return ADD_MONITOR_PRESETS.find((preset) => preset.key === presetKey) ?? ADD_MONITOR_PRESETS[0];
}

function buildSubscriptionDraft(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): SubscriptionMonitorDraft {
  return {
    name: flow.draft.name ?? "Без имени",
    url: flow.draft.url ?? "",
    intervalMinutes: flow.draft.intervalMinutes ?? env.FREE_MIN_INTERVAL_MINUTES,
    timeoutMs: env.DEFAULT_TIMEOUT_MS,
    requiredText: flow.draft.requiredText ?? null,
    checkSsl: flow.draft.checkSsl,
    checkJson: flow.draft.checkJson,
    jsonRules: flow.draft.jsonRules ?? null,
    failureThreshold: flow.draft.failureThreshold,
    recoveryThreshold: DEFAULT_RECOVERY_THRESHOLD,
  };
}

function createInitialDraft(): AddMonitorDraft {
  return {
    checkJson: false,
    checkSsl: false,
    failureThreshold: DEFAULT_FAILURE_THRESHOLD,
  };
}

function snapshotFlow(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): AddMonitorSessionSnapshot {
  return {
    step: flow.step,
    draft: {
      ...flow.draft,
      jsonRules: flow.draft.jsonRules ?? null,
      requiredText: flow.draft.requiredText ?? null,
    },
  };
}

function parseSnapshot(value: unknown): AddMonitorSessionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const step = payload.step;
  const draft = payload.draft;

  if (
    typeof step !== "string" ||
    ![
      "preset",
      "url",
      "name",
      "interval",
      "contentToggle",
      "contentText",
      "sslToggle",
      "jsonToggle",
      "jsonRules",
      "sensitivity",
      "duration",
    ].includes(step) ||
    !draft ||
    typeof draft !== "object"
  ) {
    return null;
  }

  return {
    step: step as AddMonitorStep,
    draft: draft as AddMonitorDraft,
  };
}

function getAllowedIntervals(hasPaidAccess: boolean): readonly SupportedInterval[] {
  if (hasPaidAccess) {
    return SUPPORTED_INTERVALS;
  }

  return SUPPORTED_INTERVALS.filter((value) => value >= env.FREE_MIN_INTERVAL_MINUTES) as readonly SupportedInterval[];
}

function getPreviousStep(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): AddMonitorStep | null {
  switch (flow.step) {
    case "preset":
      return null;
    case "url":
      return "preset";
    case "name":
      return "url";
    case "interval":
      return "name";
    case "contentToggle":
      return "interval";
    case "contentText":
      return "contentToggle";
    case "sslToggle":
      return flow.draft.requiredText === null ? "contentToggle" : "contentText";
    case "jsonToggle":
      return "sslToggle";
    case "jsonRules":
      return "jsonToggle";
    case "sensitivity":
      return flow.draft.checkJson ? "jsonRules" : "jsonToggle";
    case "duration":
      return "sensitivity";
    default:
      return null;
  }
}

function buildPresetPrompt(preset?: AddMonitorPreset): string {
  if (!preset) {
    return [
      "Что вы хотите мониторить?",
      "Выберите пресет, чтобы бот сразу предложил подходящий сценарий.",
    ].join("\n");
  }

  return [
    `Пресет: ${preset.label}`,
    preset.description,
    `Пример URL: ${preset.suggestedUrl}`,
    "Теперь отправьте адрес сайта или API.",
  ].join("\n");
}

function buildContentTogglePrompt(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): string {
  const preset = resolvePreset(flow.draft.presetKey);
  const recommendation = preset.contentCheckRecommended ? " Рекомендуется для этого пресета." : "";
  return `Нужна проверка содержимого страницы по обязательному тексту?${recommendation}`;
}

function buildJsonTogglePrompt(flow: Extract<BotContext["session"]["flow"], { kind: "add" }>): string {
  const preset = resolvePreset(flow.draft.presetKey);
  const recommendation = preset.jsonCheckRecommended ? " Рекомендуется для этого пресета." : "";
  return `Включить JSON-валидацию ответа?${recommendation}`;
}

function buildPlanComparisonMessage(): string {
  return [
    "Выберите тариф мониторинга.",
    `Пробный доступ: 14 дней, до ${env.FREE_MONITOR_LIMIT} монитор(ов), интервалы от ${env.FREE_MIN_INTERVAL_MINUTES} мин.`,
    `Подписка: 30 дней за ${env.TELEGRAM_STARS_MONTHLY_PRICE} Stars, до ${env.SUBSCRIPTION_MONITOR_LIMIT} монитор(ов), интервалы от 1 мин.`,
  ].join("\n");
}

async function persistCurrentStep(
  services: AppServices,
  userId: string,
  flow: Extract<BotContext["session"]["flow"], { kind: "add" }>,
): Promise<void> {
  await services.funnelService.setAddMonitorStep(
    flow.funnelSessionId,
    userId,
    STEP_TO_FUNNEL_STEP[flow.step],
    snapshotFlow(flow),
  );
}

async function moveToStep(
  ctx: BotContext,
  services: AppServices,
  flow: Extract<BotContext["session"]["flow"], { kind: "add" }>,
  step: AddMonitorStep,
): Promise<void> {
  flow.step = step;
  await persistCurrentStep(services, getCurrentUserOrThrow(ctx).id, flow);
  await renderCurrentPrompt(ctx, services, flow);
}

async function stopAddMonitorFlow(
  ctx: BotContext,
  services: AppServices,
  userId: string,
  funnelSessionId: string | undefined,
  message: string,
  step: AddMonitorFunnelStep,
  payload?: Record<string, unknown>,
): Promise<void> {
  ctx.session.flow = undefined;
  await services.funnelService.stopAddMonitorSession(funnelSessionId, userId, step, payload);
  await ctx.reply(message, mainMenuKeyboard());
}

async function renderCurrentPrompt(
  ctx: BotContext,
  services: AppServices,
  flow: Extract<BotContext["session"]["flow"], { kind: "add" }>,
): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);

  switch (flow.step) {
    case "preset":
      await ctx.reply(buildPresetPrompt(), addMonitorPresetKeyboard());
      return;
    case "url": {
      const preset = resolvePreset(flow.draft.presetKey);
      await ctx.reply(buildPresetPrompt(preset), addMonitorTextStepKeyboard(true));
      return;
    }
    case "name":
      await ctx.reply("Введите отображаемое имя проекта.", addMonitorTextStepKeyboard(true));
      return;
    case "interval": {
      const hasPaidAccess = Boolean(await services.subscriptionService.getActiveSubscriptionForUser(currentUser.id));
      await ctx.reply(
        hasPaidAccess
          ? "Выберите интервал мониторинга."
          : `Выберите интервал мониторинга. На бесплатном доступе доступны интервалы от ${env.FREE_MIN_INTERVAL_MINUTES} мин.`,
        addMonitorIntervalKeyboard(getAllowedIntervals(hasPaidAccess)),
      );
      return;
    }
    case "contentToggle":
      await ctx.reply(buildContentTogglePrompt(flow), addMonitorYesNoKeyboard("add-content:yes", "add-content:no", true));
      return;
    case "contentText":
      await ctx.reply("Введите текст, который обязательно должен присутствовать в ответе.", addMonitorTextStepKeyboard(true));
      return;
    case "sslToggle":
      await ctx.reply("Включить SSL-проверку?", addMonitorYesNoKeyboard("add-ssl:yes", "add-ssl:no", true));
      return;
    case "jsonToggle":
      await ctx.reply(buildJsonTogglePrompt(flow), addMonitorYesNoKeyboard("add-json:yes", "add-json:no", true));
      return;
    case "jsonRules":
      await ctx.reply(
        'Введите JSON-правила, каждое с новой строки. Пример:\nstatus = ok\ndata.version exists',
        addMonitorTextStepKeyboard(true),
      );
      return;
    case "sensitivity":
      await ctx.reply("Выберите чувствительность оповещений.", addMonitorSensitivityKeyboard());
      return;
    case "duration":
      await ctx.reply(buildPlanComparisonMessage(), addMonitorTermKeyboard());
      return;
    default:
      return;
  }
}

async function restoreDraftFromSession(
  ctx: BotContext,
  services: AppServices,
  sessionId: string,
): Promise<boolean> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const session = await services.funnelService.getSessionById(sessionId);

  if (!session || session.userId !== currentUser.id || session.status !== "ACTIVE") {
    await ctx.answerCbQuery("Черновик уже недоступен.", {
      show_alert: true,
    });
    return true;
  }

  const snapshot = parseSnapshot(session.lastEventPayload);

  if (!snapshot) {
    await ctx.answerCbQuery("Не удалось восстановить черновик.", {
      show_alert: true,
    });
    return true;
  }

  ctx.session.flow = {
    kind: "add",
    funnelSessionId: session.id,
    step: snapshot.step,
    draft: snapshot.draft,
  };

  await ctx.answerCbQuery("Черновик восстановлен");
  await services.funnelService.appendAddMonitorEvent(
    session.id,
    currentUser.id,
    ADD_MONITOR_FUNNEL_STEPS.draftResumed,
    snapshot,
  );
  await renderCurrentPrompt(ctx, services, ctx.session.flow);
  return true;
}

async function restartDraftSession(
  ctx: BotContext,
  services: AppServices,
  sessionId: string,
): Promise<boolean> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const session = await services.funnelService.getSessionById(sessionId);

  if (!session || session.userId !== currentUser.id) {
    await ctx.answerCbQuery("Старый черновик уже недоступен.", {
      show_alert: true,
    });
    return true;
  }

  await services.funnelService.stopAddMonitorSession(
    session.id,
    currentUser.id,
    ADD_MONITOR_FUNNEL_STEPS.draftRestarted,
    {
      restartedAt: new Date().toISOString(),
    },
  );

  const funnelSession = await services.funnelService.startAddMonitorSession(currentUser.id, {
    step: "preset",
    draft: createInitialDraft(),
  });

  ctx.session.flow = {
    kind: "add",
    funnelSessionId: funnelSession.id,
    step: "preset",
    draft: createInitialDraft(),
  };

  await ctx.answerCbQuery("Начинаем заново");
  await renderCurrentPrompt(ctx, services, ctx.session.flow);
  return true;
}

export async function startAddMonitorFlow(ctx: BotContext, services: AppServices): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const activeSession = await services.funnelService.getActiveAddMonitorSession(currentUser.id);

  if (activeSession) {
    const snapshot = parseSnapshot(activeSession.lastEventPayload);

    if (snapshot) {
      ctx.session.flow = undefined;
      await ctx.reply(
        "У вас уже есть незавершенный опрос. Можно продолжить с того же места или начать заново.",
        addMonitorResumeKeyboard(activeSession.id),
      );
      return;
    }
  }

  const draft = createInitialDraft();
  const funnelSession = await services.funnelService.startAddMonitorSession(currentUser.id, {
    step: "preset",
    draft,
  });

  ctx.session.flow = {
    kind: "add",
    funnelSessionId: funnelSession.id,
    step: "preset",
    draft,
  };

  await renderCurrentPrompt(ctx, services, ctx.session.flow);
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
      await moveToStep(ctx, services, flow, "name");
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
    await moveToStep(ctx, services, flow, "interval");
    return true;
  }

  if (flow.step === "contentText") {
    flow.draft.requiredText = text;
    await moveToStep(ctx, services, flow, "sslToggle");
    return true;
  }

  if (flow.step === "jsonRules") {
    try {
      flow.draft.jsonRules = parseJsonRulesText(text);
      await moveToStep(ctx, services, flow, "sensitivity");
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
        addMonitorTextStepKeyboard(true),
      );
    }

    return true;
  }

  return false;
}

export async function handleAddMonitorCallback(ctx: BotContext, services: AppServices): Promise<boolean> {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    return false;
  }

  const data = ctx.callbackQuery.data;

  if (data.startsWith("add-resume-session:")) {
    return restoreDraftFromSession(ctx, services, data.split(":")[1]);
  }

  if (data.startsWith("add-restart-session:")) {
    return restartDraftSession(ctx, services, data.split(":")[1]);
  }

  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "add") {
    return false;
  }

  const currentUser = getCurrentUserOrThrow(ctx);

  if (data === "add-cancel") {
    await ctx.answerCbQuery("Опрос отменен");
    await stopAddMonitorFlow(
      ctx,
      services,
      currentUser.id,
      flow.funnelSessionId,
      "Опрос остановлен. Когда будете готовы, просто нажмите «Добавить» еще раз.",
      ADD_MONITOR_FUNNEL_STEPS.cancelledByUser,
      snapshotFlow(flow),
    );
    return true;
  }

  if (data === "add-back") {
    const previousStep = getPreviousStep(flow);
    await ctx.answerCbQuery();

    if (!previousStep) {
      await stopAddMonitorFlow(
        ctx,
        services,
        currentUser.id,
        flow.funnelSessionId,
        "Опрос остановлен. Когда будете готовы, просто нажмите «Добавить» еще раз.",
        ADD_MONITOR_FUNNEL_STEPS.cancelledByUser,
        snapshotFlow(flow),
      );
      return true;
    }

    await moveToStep(ctx, services, flow, previousStep);
    return true;
  }

  if (flow.step === "preset" && data.startsWith("add-preset:")) {
    const presetKey = data.split(":")[1] as AddMonitorPresetKey;
    const preset = resolvePreset(presetKey);

    flow.draft = {
      ...flow.draft,
      ...preset.defaultDraft,
      presetKey,
      requiredText: flow.draft.requiredText ?? null,
    };

    await ctx.answerCbQuery(`Выбран пресет: ${preset.label}`);
    await moveToStep(ctx, services, flow, "url");
    return true;
  }

  if (flow.step === "interval" && data.startsWith("add-interval:")) {
    flow.draft.intervalMinutes = Number(data.split(":")[1]);
    await ctx.answerCbQuery();
    await moveToStep(ctx, services, flow, "contentToggle");
    return true;
  }

  if (flow.step === "contentToggle" && data.startsWith("add-content:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.requiredText = enabled ? undefined : null;
    await ctx.answerCbQuery();
    await moveToStep(ctx, services, flow, enabled ? "contentText" : "sslToggle");
    return true;
  }

  if (flow.step === "sslToggle" && data.startsWith("add-ssl:")) {
    flow.draft.checkSsl = data.endsWith(":yes");
    await ctx.answerCbQuery();
    await moveToStep(ctx, services, flow, "jsonToggle");
    return true;
  }

  if (flow.step === "jsonToggle" && data.startsWith("add-json:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.checkJson = enabled;
    flow.draft.jsonRules = enabled ? flow.draft.jsonRules ?? null : null;
    await ctx.answerCbQuery();
    await moveToStep(ctx, services, flow, enabled ? "jsonRules" : "sensitivity");
    return true;
  }

  if (flow.step === "sensitivity" && data.startsWith("add-sensitivity:")) {
    flow.draft.failureThreshold = Number(data.split(":")[1]);
    await ctx.answerCbQuery();
    await moveToStep(ctx, services, flow, "duration");
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
            snapshot: snapshotFlow(flow),
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
            snapshot: snapshotFlow(flow),
          },
        );
      }

      const monitor = await services.monitorService.createMonitor({
        userId: currentUser.id,
        name: flow.draft.name ?? "Без имени",
        url: flow.draft.url ?? "",
        termKind: plan.kind === "trial" ? "TRIAL" : "SUBSCRIPTION",
        intervalMinutes: flow.draft.intervalMinutes ?? env.FREE_MIN_INTERVAL_MINUTES,
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

      const monitors = await services.monitorService.listUserMonitors(currentUser.id);

      if (monitors.length === 1) {
        await offerDailySummaryOptIn(ctx, services);
      }
    } catch (error) {
      await services.funnelService.appendAddMonitorEvent(
        flow.funnelSessionId,
        currentUser.id,
        ADD_MONITOR_FUNNEL_STEPS.monitorCreationFailed,
        {
          termKey,
          snapshot: snapshotFlow(flow),
          errorMessage: error instanceof Error ? error.message : "Неизвестная ошибка",
        },
      );

      await ctx.reply(
        `Не удалось сохранить монитор. ${error instanceof Error ? error.message : ""}`.trim(),
        addMonitorTermKeyboard(),
      );
    }

    return true;
  }

  return false;
}
