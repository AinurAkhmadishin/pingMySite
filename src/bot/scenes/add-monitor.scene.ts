import { AppServices } from "../../app/services";
import { DEFAULT_FAILURE_THRESHOLD, MONITOR_TERM_PLANS, MonitorTermKey } from "../../config/constants";
import { env } from "../../config/env";
import { addDays, addMonths, formatDateTime } from "../../lib/date-time";
import { normalizeUrl } from "../../lib/url";
import { parseJsonRulesText } from "../../modules/checks/json-validator";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { intervalKeyboard, monitorTermKeyboard, sensitivityKeyboard, yesNoKeyboard } from "../keyboards/intervals";
import { mainMenuKeyboard } from "../keyboards/main-menu";

function resolveMonitorTerm(termKey: MonitorTermKey, from = new Date()) {
  const plan = MONITOR_TERM_PLANS.find((item) => item.key === termKey);

  if (!plan) {
    throw new Error("\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0442\u0430\u0440\u0438\u0444 \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433\u0430.");
  }

  return {
    plan,
    endsAt: "days" in plan ? addDays(from, plan.days) : addMonths(from, plan.months),
  };
}

async function stopAddMonitorFlow(ctx: BotContext, message: string): Promise<void> {
  ctx.session.flow = undefined;
  await ctx.reply(message, mainMenuKeyboard());
}

export async function startAddMonitorFlow(ctx: BotContext): Promise<void> {
  ctx.session.flow = {
    kind: "add",
    step: "url",
    draft: {
      checkJson: false,
      checkSsl: false,
      failureThreshold: DEFAULT_FAILURE_THRESHOLD,
    },
  };

  await ctx.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 URL \u0441\u0430\u0439\u0442\u0430 \u0438\u043b\u0438 API, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043d\u0443\u0436\u043d\u043e \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u0442\u044c.");
}

export async function handleAddMonitorText(ctx: BotContext, services: AppServices): Promise<boolean> {
  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "add" || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const text = ctx.message.text.trim();

  if (flow.step === "url") {
    try {
      const currentUser = getCurrentUserOrThrow(ctx);
      const normalizedUrl = normalizeUrl(text);
      const existingMonitor = await services.monitorService.findExistingMonitorByUrl(currentUser.id, normalizedUrl);

      if (existingMonitor) {
        await stopAddMonitorFlow(
          ctx,
          "\u042d\u0442\u043e\u0442 URL \u0443\u0436\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d \u0432 \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433. \u041e\u043f\u0440\u043e\u0441 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.",
        );
        return true;
      }

      flow.draft.url = normalizedUrl;
      flow.step = "name";
      await ctx.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430.");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0430\u0434\u0440\u0435\u0441 \u0441\u0430\u0439\u0442\u0430 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430.";

      await stopAddMonitorFlow(
        ctx,
        `\u0410\u0434\u0440\u0435\u0441 \u0441\u0430\u0439\u0442\u0430 \u043d\u0435\u0432\u0430\u043b\u0438\u0434\u043d\u044b\u0439. \u041e\u043f\u0440\u043e\u0441 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d. ${reason}`.trim(),
      );
    }

    return true;
  }

  if (flow.step === "name") {
    flow.draft.name = text;
    flow.step = "interval";
    await ctx.reply("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433\u0430.", intervalKeyboard("add-interval"));
    return true;
  }

  if (flow.step === "contentText") {
    flow.draft.requiredText = text;
    flow.step = "sslToggle";
    await ctx.reply(
      "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c SSL-\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443?",
      yesNoKeyboard("add-ssl:yes", "add-ssl:no"),
    );
    return true;
  }

  if (flow.step === "jsonRules") {
    try {
      flow.draft.jsonRules = parseJsonRulesText(text);
      flow.step = "sensitivity";
      await ctx.reply(
        "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u0439.",
        sensitivityKeyboard("add-sensitivity"),
      );
    } catch (error) {
      await ctx.reply(
        `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c JSON-\u043f\u0440\u0430\u0432\u0438\u043b\u0430. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0444\u043e\u0440\u043c\u0430\u0442 "status = ok" \u0438\u043b\u0438 "data.version exists". ${
          error instanceof Error ? error.message : ""
        }`.trim(),
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

  const data = ctx.callbackQuery.data;

  if (flow.step === "interval" && data.startsWith("add-interval:")) {
    flow.draft.intervalMinutes = Number(data.split(":")[1]);
    flow.step = "contentToggle";
    await ctx.answerCbQuery();
    await ctx.reply(
      "\u041d\u0443\u0436\u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0433\u043e \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u043f\u043e \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u043c\u0443 \u0442\u0435\u043a\u0441\u0442\u0443?",
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
      await ctx.reply(
        "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u043e\u0432\u0430\u0442\u044c \u0432 \u043e\u0442\u0432\u0435\u0442\u0435.",
      );
    } else {
      await ctx.reply(
        "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c SSL-\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443?",
        yesNoKeyboard("add-ssl:yes", "add-ssl:no"),
      );
    }

    return true;
  }

  if (flow.step === "sslToggle" && data.startsWith("add-ssl:")) {
    flow.draft.checkSsl = data.endsWith(":yes");
    flow.step = "jsonToggle";
    await ctx.answerCbQuery();
    await ctx.reply(
      "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c JSON-\u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044e \u043e\u0442\u0432\u0435\u0442\u0430?",
      yesNoKeyboard("add-json:yes", "add-json:no"),
    );
    return true;
  }

  if (flow.step === "jsonToggle" && data.startsWith("add-json:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.checkJson = enabled;
    flow.step = enabled ? "jsonRules" : "sensitivity";
    await ctx.answerCbQuery();

    if (enabled) {
      await ctx.reply(
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 JSON-\u043f\u0440\u0430\u0432\u0438\u043b\u0430, \u043a\u0430\u0436\u0434\u043e\u0435 \u0441 \u043d\u043e\u0432\u043e\u0439 \u0441\u0442\u0440\u043e\u043a\u0438. \u041f\u0440\u0438\u043c\u0435\u0440:\nstatus = ok\ndata.version exists',
      );
    } else {
      await ctx.reply(
        "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u043e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u0439.",
        sensitivityKeyboard("add-sensitivity"),
      );
    }

    return true;
  }

  if (flow.step === "sensitivity" && data.startsWith("add-sensitivity:")) {
    flow.draft.failureThreshold = Number(data.split(":")[1]);
    flow.step = "duration";
    await ctx.answerCbQuery();
    await ctx.reply(
      "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444 \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433\u0430.",
      monitorTermKeyboard("add-duration"),
    );
    return true;
  }

  if (flow.step === "duration" && data.startsWith("add-duration:")) {
    const currentUser = getCurrentUserOrThrow(ctx);
    const termKey = data.split(":")[1] as MonitorTermKey;

    await ctx.answerCbQuery();

    try {
      const { plan, endsAt } = resolveMonitorTerm(termKey);
      flow.draft.termKey = termKey;

      const monitor = await services.monitorService.createMonitor({
        userId: currentUser.id,
        name: flow.draft.name ?? "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438",
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

      await ctx.reply(
        [
          "\u041c\u043e\u043d\u0438\u0442\u043e\u0440 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d.",
          `\u041f\u0440\u043e\u0435\u043a\u0442: ${monitor.name}`,
          `\u0422\u0430\u0440\u0438\u0444: ${plan.label}`,
          `URL: ${monitor.url}`,
          `\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b: ${monitor.intervalMinutes} \u043c\u0438\u043d`,
          `\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0434\u043e: ${formatDateTime(monitor.endsAt ?? endsAt, currentUser.timezone)}`,
          `SSL: ${monitor.checkSsl ? "\u0434\u0430" : "\u043d\u0435\u0442"}`,
          `JSON: ${monitor.checkJson ? "\u0434\u0430" : "\u043d\u0435\u0442"}`,
        ].join("\n"),
        mainMenuKeyboard(),
      );
    } catch (error) {
      await ctx.reply(
        `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043c\u043e\u043d\u0438\u0442\u043e\u0440. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    }

    return true;
  }

  if (flow.step === "duration" && data.startsWith("add-duration-disabled:")) {
    await ctx.answerCbQuery("\u041e\u043f\u043b\u0430\u0442\u0430 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0430.");
    return true;
  }

  return false;
}
