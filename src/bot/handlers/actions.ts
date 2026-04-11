import { Telegraf } from "telegraf";

import { AppServices } from "../../app/services";
import { env } from "../../config/env";
import { BotContext } from "../../types/bot";
import { getCurrentUserOrThrow } from "../context";
import { removeConfirmationKeyboard } from "../keyboards/monitors";
import { RedisRateLimiter } from "../middlewares/rate-limit";
import { buildReportMessage } from "../messages/monitor-messages";
import { handleAddMonitorCallback } from "../scenes/add-monitor.scene";
import { handleSettingsCallback } from "../scenes/settings.scene";

export function registerActionHandlers(bot: Telegraf<BotContext>, services: AppServices): void {
  const manualCheckLimiter = new RedisRateLimiter(
    services.redis,
    env.MANUAL_CHECK_RATE_LIMIT_SECONDS,
    "manual-check",
  );

  bot.on("callback_query", async (ctx) => {
    if (!("data" in ctx.callbackQuery)) {
      return;
    }

    const data = ctx.callbackQuery.data;

    if (data === "noop") {
      await ctx.answerCbQuery();
      return;
    }

    if (await handleAddMonitorCallback(ctx, services)) {
      return;
    }

    if (await handleSettingsCallback(ctx, services)) {
      return;
    }

    const currentUser = getCurrentUserOrThrow(ctx);

    if (data.startsWith("report:")) {
      const monitorId = data.split(":")[1];
      const report = await services.reportService.getMonitorReport(currentUser.id, monitorId);
      await ctx.answerCbQuery();

      if (!report) {
        await ctx.reply("Не удалось сформировать отчет.");
        return;
      }

      await ctx.reply(buildReportMessage(report, currentUser.timezone));
      return;
    }

    if (data.startsWith("pause:")) {
      const monitorId = data.split(":")[1];
      const monitor = await services.monitorService.pauseMonitor(currentUser.id, monitorId);
      await ctx.answerCbQuery("Монитор поставлен на паузу");
      await ctx.reply(`Монитор "${monitor.name}" поставлен на паузу.`);
      return;
    }

    if (data.startsWith("resume:")) {
      const monitorId = data.split(":")[1];
      const monitor = await services.monitorService.resumeMonitor(currentUser.id, monitorId);
      await ctx.answerCbQuery("Монитор возобновлен");
      await ctx.reply(`Монитор "${monitor.name}" снова активен.`);
      return;
    }

    if (data.startsWith("remove:")) {
      const monitorId = data.split(":")[1];
      const monitor = await services.monitorService.getMonitorForUser(currentUser.id, monitorId);
      await ctx.answerCbQuery();
      await ctx.reply(
        `Удалить монитор "${monitor.name}"? История проверок сохранится.`,
        removeConfirmationKeyboard(monitor.id),
      );
      return;
    }

    if (data.startsWith("remove-confirm:")) {
      const monitorId = data.split(":")[1];
      const monitor = await services.monitorService.removeMonitor(currentUser.id, monitorId);
      await ctx.answerCbQuery("Монитор удален");
      await ctx.reply(`Монитор "${monitor.name}" удален из активного списка.`);
      return;
    }

    if (data.startsWith("check:")) {
      const monitorId = data.split(":")[1];
      const rateLimit = await manualCheckLimiter.check(`${currentUser.id}:${monitorId}`);

      if (!rateLimit.allowed) {
        await ctx.answerCbQuery(`Подождите ${rateLimit.retryAfterSeconds} сек`, {
          show_alert: true,
        });
        return;
      }

      await ctx.answerCbQuery("Запускаю проверку...");

      const result = await services.monitorCheckService.runManualCheck(monitorId);

      if (!result) {
        await ctx.reply("Не удалось выполнить ручную проверку.");
        return;
      }

      await services.notificationService.sendManualCheckResult(result.monitor, result.result);
    }
  });
}
