import { User } from "@prisma/client";
import { Markup } from "telegraf";

import { DAILY_SUMMARY_TIME_OPTIONS } from "../../config/constants";
import { formatTimeOfDay } from "../../lib/date-time";

export function settingsHomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Мониторы", "settings-section:monitors")],
    [Markup.button.callback("Уведомления", "settings-section:notifications")],
  ]);
}

export function notificationSettingsKeyboard(user: User) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        user.dailySummaryEnabled ? "Выключить ежедневную сводку" : "Включить ежедневную сводку",
        "daily-summary:toggle",
      ),
    ],
    [
      Markup.button.callback(
        user.dailySummaryTimeMinutes === null
          ? "Выбрать время"
          : `Время: ${formatTimeOfDay(user.dailySummaryTimeMinutes)} МСК`,
        "daily-summary:change-time",
      ),
    ],
    [Markup.button.callback("Назад", "settings-home")],
  ]);
}

export function dailySummaryTimeKeyboard() {
  const rows = [];

  for (let index = 0; index < DAILY_SUMMARY_TIME_OPTIONS.length; index += 2) {
    const slice = DAILY_SUMMARY_TIME_OPTIONS.slice(index, index + 2);
    rows.push(
      slice.map((value) => Markup.button.callback(`${formatTimeOfDay(value)} МСК`, `daily-summary-time:set:${value}`)),
    );
  }

  return Markup.inlineKeyboard([
    ...rows,
    [Markup.button.callback("Ввести вручную", "daily-summary-time:custom")],
    [Markup.button.callback("Назад", "settings-section:notifications")],
  ]);
}

export function dailySummaryOfferKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Включить", "daily-summary:offer-enable")],
    [Markup.button.callback("Не сейчас", "daily-summary:offer-skip")],
  ]);
}
