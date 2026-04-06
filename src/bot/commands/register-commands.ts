import { Telegraf } from "telegraf";

import { AppServices } from "../../app/services";
import { BOT_MENU_TEXT } from "../../config/constants";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { intervalKeyboard } from "../keyboards/intervals";
import { mainMenuKeyboard } from "../keyboards/main-menu";
import { monitorSelectionKeyboard } from "../keyboards/monitors";
import {
  buildHelpMessage,
  buildMonitorListMessage,
  buildReportMessage,
  buildStartMessage,
  buildStatusMessage,
} from "../messages/monitor-messages";
import { startAddMonitorFlow } from "../scenes/add-monitor.scene";

async function withUserMonitors(
  ctx: BotContext,
  services: AppServices,
  options?: { pausedOnly?: boolean; activeOnly?: boolean },
) {
  const currentUser = getCurrentUserOrThrow(ctx);
  return services.monitorService.listUserMonitors(currentUser.id, options);
}

export async function handleStartCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(buildStartMessage(ctx.from?.first_name), mainMenuKeyboard());
}

export async function handleHelpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(buildHelpMessage(), mainMenuKeyboard());
}

export async function handleListCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);
  await ctx.reply(buildMonitorListMessage(monitors));
}

export async function handleStatusCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);
  await ctx.reply(buildStatusMessage(monitors));
}

export async function handleReportCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);

  if (monitors.length === 0) {
    await ctx.reply("Сначала добавьте монитор через /add.");
    return;
  }

  await ctx.reply("Выберите монитор для отчета.", monitorSelectionKeyboard(monitors, "report"));
}

export async function handlePauseCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services, {
    activeOnly: true,
  });

  if (monitors.length === 0) {
    await ctx.reply("Нет активных мониторов для паузы.");
    return;
  }

  await ctx.reply("Какой монитор поставить на паузу?", monitorSelectionKeyboard(monitors, "pause"));
}

export async function handleResumeCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services, {
    pausedOnly: true,
  });

  if (monitors.length === 0) {
    await ctx.reply("Нет мониторов в паузе.");
    return;
  }

  await ctx.reply("Какой монитор возобновить?", monitorSelectionKeyboard(monitors, "resume"));
}

export async function handleRemoveCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);

  if (monitors.length === 0) {
    await ctx.reply("Удалять пока нечего.");
    return;
  }

  await ctx.reply("Выберите монитор для удаления.", monitorSelectionKeyboard(monitors, "remove"));
}

export async function handleSettingsCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);

  if (monitors.length === 0) {
    await ctx.reply("Сначала добавьте монитор.");
    return;
  }

  await ctx.reply("Выберите монитор для настройки.", monitorSelectionKeyboard(monitors, "settings-open"));
}

export async function handleCheckNowCommand(ctx: BotContext, services: AppServices): Promise<void> {
  const monitors = await withUserMonitors(ctx, services);

  if (monitors.length === 0) {
    await ctx.reply("Проверять пока нечего.");
    return;
  }

  await ctx.reply("Какой монитор проверить прямо сейчас?", monitorSelectionKeyboard(monitors, "check"));
}

export function registerCommands(bot: Telegraf<BotContext>, services: AppServices): void {
  bot.start(handleStartCommand);
  bot.command("help", (ctx) => handleHelpCommand(ctx));
  bot.command("add", (ctx) => startAddMonitorFlow(ctx));
  bot.command("list", (ctx) => handleListCommand(ctx, services));
  bot.command("status", (ctx) => handleStatusCommand(ctx, services));
  bot.command("report", (ctx) => handleReportCommand(ctx, services));
  bot.command("pause", (ctx) => handlePauseCommand(ctx, services));
  bot.command("resume", (ctx) => handleResumeCommand(ctx, services));
  bot.command("remove", (ctx) => handleRemoveCommand(ctx, services));
  bot.command("settings", (ctx) => handleSettingsCommand(ctx, services));
  bot.command("checknow", (ctx) => handleCheckNowCommand(ctx, services));

  void bot.telegram.setMyCommands([
    { command: "start", description: "Главное меню" },
    { command: "help", description: "Справка по возможностям" },
    { command: "add", description: "Добавить новый монитор" },
    { command: "list", description: "Список мониторов" },
    { command: "status", description: "Текущий статус" },
    { command: "report", description: "Uptime и инциденты" },
    { command: "pause", description: "Пауза мониторинга" },
    { command: "resume", description: "Возобновить мониторинг" },
    { command: "remove", description: "Удалить монитор" },
    { command: "settings", description: "Изменить настройки" },
    { command: "checknow", description: "Проверить монитор сейчас" },
  ]);
}
