import { DEFAULT_FAILURE_THRESHOLD } from "../../config/constants";
import { AppServices } from "../../app/services";
import { intervalKeyboard, sensitivityKeyboard, yesNoKeyboard } from "../keyboards/intervals";
import { mainMenuKeyboard } from "../keyboards/main-menu";
import { getCurrentUserOrThrow } from "../context";
import { parseJsonRulesText } from "../../modules/checks/json-validator";
import { BotContext } from "../../types/bot";
import { env } from "../../config/env";
import { normalizeUrl } from "../../lib/url";

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

  await ctx.reply("Введите URL сайта или API, который нужно мониторить.");
}

export async function handleAddMonitorText(ctx: BotContext, services: AppServices): Promise<boolean> {
  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "add" || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const text = ctx.message.text.trim();

  if (flow.step === "url") {
    try {
      flow.draft.url = normalizeUrl(text);
      flow.step = "name";
      await ctx.reply("Введите отображаемое имя проекта.");
    } catch (error) {
      await ctx.reply(`Не удалось распознать URL. ${error instanceof Error ? error.message : ""}`.trim());
    }

    return true;
  }

  if (flow.step === "name") {
    flow.draft.name = text;
    flow.step = "interval";
    await ctx.reply("Выберите интервал мониторинга.", intervalKeyboard("add-interval"));
    return true;
  }

  if (flow.step === "contentText") {
    flow.draft.requiredText = text;
    flow.step = "sslToggle";
    await ctx.reply("Включить SSL-проверку?", yesNoKeyboard("add-ssl:yes", "add-ssl:no"));
    return true;
  }

  if (flow.step === "jsonRules") {
    try {
      flow.draft.jsonRules = parseJsonRulesText(text);
      flow.step = "sensitivity";
      await ctx.reply("Выберите чувствительность оповещений.", sensitivityKeyboard("add-sensitivity"));
    } catch (error) {
      await ctx.reply(
        `Не удалось распознать JSON-правила. Используйте формат "status = ok" или "data.version exists". ${
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
    await ctx.reply("Нужна проверка содержимого страницы по обязательному тексту?", yesNoKeyboard("add-content:yes", "add-content:no"));
    return true;
  }

  if (flow.step === "contentToggle" && data.startsWith("add-content:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.requiredText = enabled ? undefined : null;
    flow.step = enabled ? "contentText" : "sslToggle";
    await ctx.answerCbQuery();

    if (enabled) {
      await ctx.reply("Введите текст, который обязательно должен присутствовать в ответе.");
    } else {
      await ctx.reply("Включить SSL-проверку?", yesNoKeyboard("add-ssl:yes", "add-ssl:no"));
    }

    return true;
  }

  if (flow.step === "sslToggle" && data.startsWith("add-ssl:")) {
    flow.draft.checkSsl = data.endsWith(":yes");
    flow.step = "jsonToggle";
    await ctx.answerCbQuery();
    await ctx.reply("Включить JSON-валидацию ответа?", yesNoKeyboard("add-json:yes", "add-json:no"));
    return true;
  }

  if (flow.step === "jsonToggle" && data.startsWith("add-json:")) {
    const enabled = data.endsWith(":yes");
    flow.draft.checkJson = enabled;
    flow.step = enabled ? "jsonRules" : "sensitivity";
    await ctx.answerCbQuery();

    if (enabled) {
      await ctx.reply('Введите JSON-правила, каждое с новой строки. Пример:\nstatus = ok\ndata.version exists');
    } else {
      await ctx.reply("Выберите чувствительность оповещений.", sensitivityKeyboard("add-sensitivity"));
    }

    return true;
  }

  if (flow.step === "sensitivity" && data.startsWith("add-sensitivity:")) {
    flow.draft.failureThreshold = Number(data.split(":")[1]);
    await ctx.answerCbQuery();

    const currentUser = getCurrentUserOrThrow(ctx);

    try {
      const monitor = await services.monitorService.createMonitor({
        userId: currentUser.id,
        name: flow.draft.name ?? "Без имени",
        url: flow.draft.url ?? "",
        intervalMinutes: flow.draft.intervalMinutes ?? 5,
        timeoutMs: env.DEFAULT_TIMEOUT_MS,
        requiredText: flow.draft.requiredText ?? null,
        checkSsl: flow.draft.checkSsl,
        checkJson: flow.draft.checkJson,
        jsonRules: flow.draft.jsonRules ?? null,
        failureThreshold: flow.draft.failureThreshold,
      });

      ctx.session.flow = undefined;

      await ctx.reply(
        [
          "Монитор сохранен.",
          `Проект: ${monitor.name}`,
          `URL: ${monitor.url}`,
          `Интервал: ${monitor.intervalMinutes} мин`,
          `SSL: ${monitor.checkSsl ? "да" : "нет"}`,
          `JSON: ${monitor.checkJson ? "да" : "нет"}`,
        ].join("\n"),
        mainMenuKeyboard(),
      );
    } catch (error) {
      await ctx.reply(`Не удалось сохранить монитор. ${error instanceof Error ? error.message : ""}`.trim());
    }

    return true;
  }

  return false;
}
