import { User } from "@prisma/client";

import { formatTimeOfDay } from "../../lib/date-time";

export function buildSettingsHomeMessage(): string {
  return "Что хотите настроить?";
}

export function buildNotificationSettingsMessage(user: User): string {
  return [
    "Уведомления",
    `Ежедневная сводка: ${user.dailySummaryEnabled ? "включена" : "выключена"}`,
    `Время: ${user.dailySummaryTimeMinutes === null ? "не выбрано" : `${formatTimeOfDay(user.dailySummaryTimeMinutes)} МСК`}`,
    "Сводка приходит раз в день по всем активным мониторам пользователя.",
  ].join("\n");
}

export function buildDailySummaryOfferMessage(): string {
  return [
    "Монитор добавлен.",
    "Могу раз в день присылать краткую сводку по всем активным мониторам.",
    "Включить ежедневную сводку?",
  ].join("\n");
}

export function buildDailySummaryTimePrompt(currentTimeMinutes?: number | null): string {
  const currentTime =
    typeof currentTimeMinutes === "number" ? `Сейчас выбрано: ${formatTimeOfDay(currentTimeMinutes)} МСК.\n` : "";

  return [
    `${currentTime}Во сколько присылать ежедневную сводку по МСК?`,
    "Можно выбрать время кнопкой или отправить его вручную в формате 09:30.",
  ].join("\n");
}

export function buildDailySummarySavedMessage(timeMinutes: number): string {
  return `Готово. Буду присылать ежедневную сводку каждый день в ${formatTimeOfDay(timeMinutes)} МСК, если есть активные мониторы.`;
}

export function buildDailySummaryDisabledMessage(): string {
  return "Ежедневная сводка отключена. Включить ее снова можно в разделе уведомлений.";
}

export function buildDailySummarySkippedMessage(): string {
  return "Хорошо, пока не включаю. Сделать это можно позже в разделе уведомлений.";
}

export function buildInvalidDailySummaryTimeMessage(): string {
  return "Не удалось распознать время. Отправьте его в формате 09:30 по МСК.";
}
