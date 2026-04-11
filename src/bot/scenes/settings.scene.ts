import { AppServices } from "../../app/services";
import { parseTimeOfDay } from "../../lib/date-time";
import { parseJsonRulesText } from "../../modules/checks/json-validator";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { intervalKeyboard, sensitivityKeyboard } from "../keyboards/intervals";
import { monitorSelectionKeyboard } from "../keyboards/monitors";
import { settingsKeyboard } from "../keyboards/settings";
import {
  dailySummaryOfferKeyboard,
  dailySummaryTimeKeyboard,
  notificationSettingsKeyboard,
  settingsHomeKeyboard,
} from "../keyboards/user-settings";
import { buildSettingsMenuMessage } from "../messages/monitor-messages";
import {
  buildDailySummaryDisabledMessage,
  buildDailySummaryOfferMessage,
  buildDailySummarySavedMessage,
  buildDailySummarySkippedMessage,
  buildDailySummaryTimePrompt,
  buildInvalidDailySummaryTimeMessage,
  buildNotificationSettingsMessage,
  buildSettingsHomeMessage,
} from "../messages/user-settings-messages";

async function updateCurrentUser(
  ctx: BotContext,
  services: AppServices,
  input: {
    enabled?: boolean;
    timeMinutes?: number | null;
    lastSentAt?: Date | null;
    promptedAt?: Date;
  },
) {
  const currentUser = getCurrentUserOrThrow(ctx);
  const updatedUser = await services.userService.updateDailySummarySettings(currentUser.id, input);
  ctx.state.currentUser = updatedUser;

  return updatedUser;
}

async function openMonitorSettingsSelection(ctx: BotContext, services: AppServices): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const monitors = await services.monitorService.listUserMonitors(currentUser.id);

  if (monitors.length === 0) {
    await ctx.reply("Сначала добавьте монитор.", settingsHomeKeyboard());
    return;
  }

  await ctx.reply("Выберите монитор для настройки.", monitorSelectionKeyboard(monitors, "settings-open"));
}

async function openNotificationSettings(ctx: BotContext): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  ctx.session.flow = undefined;
  await ctx.reply(buildNotificationSettingsMessage(currentUser), notificationSettingsKeyboard(currentUser));
}

async function promptDailySummaryTime(ctx: BotContext): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  await ctx.reply(buildDailySummaryTimePrompt(currentUser.dailySummaryTimeMinutes), dailySummaryTimeKeyboard());
}

async function saveDailySummaryTime(ctx: BotContext, services: AppServices, timeMinutes: number): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const updatedUser = await updateCurrentUser(ctx, services, {
    enabled: true,
    timeMinutes,
    promptedAt: currentUser.dailySummaryPromptedAt ?? new Date(),
  });

  ctx.session.flow = undefined;
  await ctx.reply(buildDailySummarySavedMessage(timeMinutes), notificationSettingsKeyboard(updatedUser));
}

export async function openSettingsHome(ctx: BotContext): Promise<void> {
  ctx.session.flow = undefined;
  await ctx.reply(buildSettingsHomeMessage(), settingsHomeKeyboard());
}

export async function openSettingsMenu(ctx: BotContext, services: AppServices, monitorId: string): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);
  const monitor = await services.monitorService.getMonitorForUser(currentUser.id, monitorId);

  await ctx.reply(buildSettingsMenuMessage(monitor), settingsKeyboard(monitor));
}

export async function offerDailySummaryOptIn(ctx: BotContext, services: AppServices): Promise<void> {
  const currentUser = getCurrentUserOrThrow(ctx);

  if (currentUser.dailySummaryEnabled || currentUser.dailySummaryPromptedAt) {
    return;
  }

  await updateCurrentUser(ctx, services, {
    promptedAt: new Date(),
  });
  await ctx.reply(buildDailySummaryOfferMessage(), dailySummaryOfferKeyboard());
}

export async function handleSettingsCallback(ctx: BotContext, services: AppServices): Promise<boolean> {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    return false;
  }

  const data = ctx.callbackQuery.data;
  const currentUser = getCurrentUserOrThrow(ctx);

  if (data === "settings-home") {
    await ctx.answerCbQuery();
    await openSettingsHome(ctx);
    return true;
  }

  if (data === "settings-section:monitors") {
    await ctx.answerCbQuery();
    await openMonitorSettingsSelection(ctx, services);
    return true;
  }

  if (data === "settings-section:notifications") {
    await ctx.answerCbQuery();
    await openNotificationSettings(ctx);
    return true;
  }

  if (data === "daily-summary:offer-enable") {
    await ctx.answerCbQuery();
    await promptDailySummaryTime(ctx);
    return true;
  }

  if (data === "daily-summary:offer-skip") {
    await ctx.answerCbQuery("Ок");
    await ctx.reply(buildDailySummarySkippedMessage());
    return true;
  }

  if (data === "daily-summary:toggle") {
    await ctx.answerCbQuery();

    if (currentUser.dailySummaryEnabled) {
      const updatedUser = await updateCurrentUser(ctx, services, {
        enabled: false,
      });
      ctx.session.flow = undefined;
      await ctx.reply(buildDailySummaryDisabledMessage(), notificationSettingsKeyboard(updatedUser));
      return true;
    }

    if (typeof currentUser.dailySummaryTimeMinutes === "number") {
      const updatedUser = await updateCurrentUser(ctx, services, {
        enabled: true,
        promptedAt: currentUser.dailySummaryPromptedAt ?? new Date(),
      });
      await ctx.reply(
        buildDailySummarySavedMessage(currentUser.dailySummaryTimeMinutes),
        notificationSettingsKeyboard(updatedUser),
      );
      return true;
    }

    await promptDailySummaryTime(ctx);
    return true;
  }

  if (data === "daily-summary:change-time") {
    await ctx.answerCbQuery();
    await promptDailySummaryTime(ctx);
    return true;
  }

  if (data === "daily-summary-time:custom") {
    ctx.session.flow = {
      kind: "notification-settings",
      field: "dailySummaryTime",
    };
    await ctx.answerCbQuery();
    await ctx.reply(buildDailySummaryTimePrompt(currentUser.dailySummaryTimeMinutes));
    return true;
  }

  if (data.startsWith("daily-summary-time:set:")) {
    const value = Number(data.split(":")[2]);

    await ctx.answerCbQuery("Время сохранено");
    await saveDailySummaryTime(ctx, services, value);
    return true;
  }

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

  if (!flow || !ctx.message || !("text" in ctx.message)) {
    return false;
  }

  if (flow.kind === "notification-settings") {
    const timeMinutes = parseTimeOfDay(ctx.message.text.trim());

    if (timeMinutes === null) {
      await ctx.reply(buildInvalidDailySummaryTimeMessage(), dailySummaryTimeKeyboard());
      return true;
    }

    await saveDailySummaryTime(ctx, services, timeMinutes);
    return true;
  }

  if (flow.kind !== "settings") {
    return false;
  }

  const currentUser = getCurrentUserOrThrow(ctx);
  const text = ctx.message.text.trim();

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
