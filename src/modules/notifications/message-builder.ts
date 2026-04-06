import { MonitorWithUser } from "../monitors/monitor.repository";
import { formatDateTime, formatDurationSeconds, formatPercent } from "../../lib/date-time";
import { MonitorCheckExecutionResult } from "../checks/types";

export function buildDownAlertMessage(
  monitor: MonitorWithUser,
  input: {
    reason: string;
    checkedAt: Date;
    consecutiveFailures: number;
  },
): string {
  return [
    "🔴 Сайт недоступен",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Причина: ${input.reason}`,
    `Подтверждено: ${input.consecutiveFailures} неудачные проверки подряд`,
    `Время: ${formatDateTime(input.checkedAt, monitor.user.timezone)}`,
  ].join("\n");
}

export function buildRecoveryAlertMessage(
  monitor: MonitorWithUser,
  input: {
    statusCode?: number;
    recoveredAt: Date;
    durationSeconds: number;
  },
): string {
  return [
    "🟢 Сайт восстановлен",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Снова отвечает: ${input.statusCode ?? "n/a"}`,
    `Время восстановления: ${formatDateTime(input.recoveredAt, monitor.user.timezone)}`,
    `Длительность сбоя: ${formatDurationSeconds(input.durationSeconds)}`,
  ].join("\n");
}

export function buildSslExpiringAlertMessage(
  monitor: MonitorWithUser,
  input: {
    expiresAt: Date;
    daysLeft: number;
  },
): string {
  return [
    "🟠 SSL-сертификат скоро истечет",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Осталось дней: ${input.daysLeft}`,
    `Дата истечения: ${formatDateTime(input.expiresAt, monitor.user.timezone)}`,
  ].join("\n");
}

export function buildManualCheckMessage(result: MonitorCheckExecutionResult): string {
  return [
    "Проверка выполнена",
    `Статус: ${result.statusCode ?? "n/a"}`,
    `Время ответа: ${result.responseTimeMs ?? "n/a"} ms`,
    `Текст найден: ${result.contentMatched === undefined ? "не задан" : result.contentMatched ? "да" : "нет"}`,
    `JSON валиден: ${result.jsonMatched === undefined ? "не задан" : result.jsonMatched ? "да" : "нет"}`,
    `Результат: ${result.success ? "успешно" : `ошибка (${result.errorMessage ?? "неизвестно"})`}`,
  ].join("\n");
}

export function buildDailySummaryMessage(input: {
  monitorCount: number;
  failedChecks: number;
  incidentsOpened: number;
  averageUptimePercent: number;
}): string {
  return [
    "Ежедневная сводка",
    `Мониторов: ${input.monitorCount}`,
    `Неудачных проверок: ${input.failedChecks}`,
    `Новых инцидентов: ${input.incidentsOpened}`,
    `Средний uptime: ${formatPercent(input.averageUptimePercent)}`,
  ].join("\n");
}

export function buildWeeklySummaryMessage(input: {
  monitorCount: number;
  incidentsOpened: number;
  averageUptimePercent: number;
  slowestMonitors: Array<{ name: string; averageResponseTimeMs: number }>;
}): string {
  const slowestLines =
    input.slowestMonitors.length > 0
      ? input.slowestMonitors.map((monitor, index) => `${index + 1}. ${monitor.name} — ${monitor.averageResponseTimeMs} ms`)
      : ["1. Нет данных"];

  return [
    "Еженедельная сводка",
    `Мониторов: ${input.monitorCount}`,
    `Инцидентов: ${input.incidentsOpened}`,
    `Средний uptime: ${formatPercent(input.averageUptimePercent)}`,
    "Самые медленные мониторы:",
    ...slowestLines,
  ].join("\n");
}
