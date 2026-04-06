import { Telegraf } from "telegraf";

import { AppServices } from "../../app/services";
import { BOT_MENU_TEXT } from "../../config/constants";
import { BotContext } from "../../types/bot";
import {
  handleCheckNowCommand,
  handleHelpCommand,
  handleListCommand,
  handlePauseCommand,
  handleReportCommand,
  handleRemoveCommand,
  handleResumeCommand,
  handleSettingsCommand,
  handleStartCommand,
  handleStatusCommand,
} from "../commands/register-commands";
import { handleAddMonitorText, startAddMonitorFlow } from "../scenes/add-monitor.scene";
import { handleSettingsText } from "../scenes/settings.scene";

export function registerTextHandlers(bot: Telegraf<BotContext>, services: AppServices): void {
  bot.on("text", async (ctx) => {
    if (!("text" in ctx.message)) {
      return;
    }

    const text = ctx.message.text.trim();

    if (text.startsWith("/")) {
      return;
    }

    if (await handleAddMonitorText(ctx, services)) {
      return;
    }

    if (await handleSettingsText(ctx, services)) {
      return;
    }

    if (text === BOT_MENU_TEXT.add) {
      await startAddMonitorFlow(ctx);
      return;
    }

    if (text === BOT_MENU_TEXT.list) {
      await handleListCommand(ctx, services);
      return;
    }

    if (text === BOT_MENU_TEXT.status) {
      await handleStatusCommand(ctx, services);
      return;
    }

    if (text === BOT_MENU_TEXT.report) {
      await handleReportCommand(ctx, services);
      return;
    }

    if (text === BOT_MENU_TEXT.settings) {
      await handleSettingsCommand(ctx, services);
      return;
    }

    if (text === BOT_MENU_TEXT.help) {
      await handleHelpCommand(ctx);
      return;
    }

    await handleStartCommand(ctx);
  });
}
