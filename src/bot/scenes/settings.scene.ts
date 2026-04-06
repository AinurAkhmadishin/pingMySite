import { AppServices } from "../../app/services";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { intervalKeyboard, sensitivityKeyboard } from "../keyboards/intervals";
import { settingsKeyboard } from "../keyboards/settings";
import { buildSettingsMenuMessage } from "../messages/monitor-messages";
import { parseJsonRulesText } from "../../modules/checks/json-validator";

export async function openSettingsMenu(ctx: BotContext, services: AppServices, monitorId: string): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const monitor = await services.monitorService.getMonitorForUser(currentUser.id, monitorId);

  await ctx.reply(buildSettingsMenuMessage(monitor), settingsKeyboard(monitor));
}

export async function handleSettingsCallback(ctx: BotContext, services: AppServices): Promise<boolean> {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    return false;
  }

  const data = ctx.callbackQuery.data;
  const currentUser = getCurrentUserOrThrow(ctx);

  if (data.startsWith("settings-open:")) {
    await ctx.answerCbQuery();
    await openSettingsMenu(ctx, services, data.split(":")[1]);
    return true;
  }

  if (data.startsWith("settings-interval:")) {
    const monitorId = data.split(":")[1];
    await ctx.answerCbQuery();
    await ctx.reply("Выберите новый интервал.", intervalKeyboard(`settings-interval-value:${monitorId}`));
    return true;
  }

  if (data.startsWith("settings-interval-value:")) {
    const [, monitorId, value] = data.split(":");
    await services.monitorService.updateMonitorSettings(currentUser.id, monitorId, {
      intervalMinutes: Number(value),
    });
    await ctx.answerCbQuery("Интервал обновлен");
    await openSettingsMenu(ctx, services, monitorId);
    return true;
  }

  if (data.startsWith("settings-timeout:")) {
    ctx.session.flow = {
      kind: "settings",
      monitorId: data.split(":")[1],
      field: "timeout",
    };
    await ctx.answerCbQuery();
    await ctx.reply("Введите новый таймаут в миллисекундах, например 5000.");
    return true;
  }

  if (data.startsWith("settings-text:")) {
    ctx.session.flow = {
      kind: "settings",
      monitorId: data.split(":")[1],
      field: "requiredText",
    };
    await ctx.answerCbQuery();
    await ctx.reply('Введите обязательный текст или отправьте "off", чтобы отключить проверку.');
    return true;
  }

  if (data.startsWith("settings-json:")) {
    ctx.session.flow = {
      kind: "settings",
      monitorId: data.split(":")[1],
      field: "jsonRules",
    };
    await ctx.answerCbQuery();
    await ctx.reply('Введите JSON-правила или отправьте "off", чтобы отключить JSON-валидацию.');
    return true;
  }

  if (data.startsWith("settings-sensitivity:")) {
    const monitorId = data.split(":")[1];
    await ctx.answerCbQuery();
    await ctx.reply("Выберите новую чувствительность.", sensitivityKeyboard(`settings-sensitivity-value:${monitorId}`));
    return true;
  }

  if (data.startsWith("settings-sensitivity-value:")) {
    const [, monitorId, value] = data.split(":");
    await services.monitorService.updateMonitorSettings(currentUser.id, monitorId, {
      failureThreshold: Number(value),
    });
    await ctx.answerCbQuery("Чувствительность обновлена");
    await openSettingsMenu(ctx, services, monitorId);
    return true;
  }

  if (data.startsWith("settings-ssl:")) {
    const monitorId = data.split(":")[1];
    const monitor = await services.monitorService.getMonitorForUser(currentUser.id, monitorId);
    await services.monitorService.updateMonitorSettings(currentUser.id, monitorId, {
      checkSsl: !monitor.checkSsl,
    });
    await ctx.answerCbQuery("SSL-настройка обновлена");
    await openSettingsMenu(ctx, services, monitorId);
    return true;
  }

  return false;
}

export async function handleSettingsText(ctx: BotContext, services: AppServices): Promise<boolean> {
  const flow = ctx.session.flow;

  if (!flow || flow.kind !== "settings" || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  const currentUser = getCurrentUserOrThrow(ctx);
  const text = ctx.message.text.trim();

  if (flow.field === "timeout") {
    const timeoutMs = Number(text);

    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
      await ctx.reply("Таймаут должен быть числом от 1000 до 30000.");
      return true;
    }

    await services.monitorService.updateMonitorSettings(currentUser.id, flow.monitorId, {
      timeoutMs,
    });
  }

  if (flow.field === "requiredText") {
    await services.monitorService.updateMonitorSettings(currentUser.id, flow.monitorId, {
      requiredText: text.toLowerCase() === "off" ? null : text,
    });
  }

  if (flow.field === "jsonRules") {
    await services.monitorService.updateMonitorSettings(currentUser.id, flow.monitorId, {
      jsonRules: text.toLowerCase() === "off" ? null : parseJsonRulesText(text),
      checkJson: text.toLowerCase() !== "off",
    });
  }

  ctx.session.flow = undefined;
  await ctx.reply("Настройки обновлены.");
  await openSettingsMenu(ctx, services, flow.monitorId);

  return true;
}
