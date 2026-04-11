import { formatDateTime, formatDurationSeconds, formatPercent } from "../../lib/date-time";
import { MonitorCheckExecutionResult } from "../checks/types";
import { MonitorWithUser } from "../monitors/monitor.repository";

export function buildDownAlertMessage(
  monitor: MonitorWithUser,
  input: {
    reason: string;
    checkedAt: Date;
    consecutiveFailures: number;
  },
): string {
  return [
    "Сайт недоступен",
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
    "Сайт восстановлен",
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
    "SSL-сертификат скоро истечет",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Осталось дней: ${input.daysLeft}`,
    `Дата истечения: ${formatDateTime(input.expiresAt, monitor.user.timezone)}`,
  ].join("\n");
}

export function buildManualCheckMessage(monitor: MonitorWithUser, result: MonitorCheckExecutionResult): string {
  return [
    "Проверка выполнена",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Статус: ${result.statusCode ?? "n/a"}`,
    `Время ответа: ${result.responseTimeMs ?? "n/a"} ms`,
    `Текст найден: ${result.contentMatched === undefined ? "не задан" : result.contentMatched ? "да" : "нет"}`,
    `JSON валиден: ${result.jsonMatched === undefined ? "не задан" : result.jsonMatched ? "да" : "нет"}`,
    `Результат: ${result.success ? "успешно" : `ошибка (${result.errorMessage ?? "неизвестно"})`}`,
  ].join("\n");
}

export function buildDailySummaryMessage(input: {
  activeMonitorCount: number;
  pausedMonitorCount: number;
  upCount: number;
  downCount: number;
  unknownCount: number;
  problematicMonitors: Array<{
    name: string;
    url: string;
    state: "DOWN" | "UNKNOWN";
    lastCheckedAt?: Date | null;
    lastErrorMessage?: string | null;
  }>;
  timeZone: string;
}): string {
  const problemLines =
    input.problematicMonitors.length > 0
      ? [
          "Требуют внимания:",
          ...input.problematicMonitors.flatMap((monitor, index) =>
            [
              `${index + 1}. ${monitor.name} - ${monitor.state}`,
              `URL: ${monitor.url}`,
              monitor.lastCheckedAt ? `Последняя проверка: ${formatDateTime(monitor.lastCheckedAt, input.timeZone)}` : "",
              monitor.lastErrorMessage ? `Ошибка: ${monitor.lastErrorMessage}` : "",
            ].filter(Boolean),
          ),
        ]
      : ["Все активные мониторы сейчас в порядке."];

  return [
    "Ежедневная сводка",
    `Активных мониторов: ${input.activeMonitorCount}`,
    `UP: ${input.upCount}`,
    `DOWN: ${input.downCount}`,
    `UNKNOWN: ${input.unknownCount}`,
    input.pausedMonitorCount > 0 ? `На паузе: ${input.pausedMonitorCount}` : "",
    "",
    ...problemLines,
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
      ? input.slowestMonitors.map((monitor, index) => `${index + 1}. ${monitor.name} - ${monitor.averageResponseTimeMs} ms`)
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

export function buildTrialEndingSoonMessage(monitor: MonitorWithUser, daysLeft: number): string {
  return [
    "Пробный период скоро закончится",
    `Проект: ${monitor.name}`,
    `URL: ${monitor.url}`,
    `Осталось дней: ${daysLeft}`,
    `Мониторинг активен до: ${formatDateTime(monitor.endsAt ?? new Date(), monitor.user.timezone)}`,
    "Чтобы не потерять мониторинг, подключите платную подписку через /subscription.",
  ].join("\n");
}

export function buildSubscriptionEndingSoonMessage(input: {
  planLabel: string;
  currentPeriodEnd: Date;
  daysLeft: number;
  timeZone: string;
}): string {
  return [
    "Подписка скоро закончится",
    `Тариф: ${input.planLabel}`,
    `Осталось дней: ${input.daysLeft}`,
    `Доступ действует до: ${formatDateTime(input.currentPeriodEnd, input.timeZone)}`,
    "Продлить подписку можно в любой момент через /subscription.",
  ].join("\n");
}

export function buildAdminHealthAlertMessage(input: {
  workerAlive: boolean;
  stuckUnknownCount: number;
  staleAfterMinutes: number;
}): string {
  const problems: string[] = [];

  if (!input.workerAlive) {
    problems.push("worker перестал присылать heartbeat");
  }

  if (input.stuckUnknownCount > 0) {
    problems.push(
      `${input.stuckUnknownCount} активных мониторов зависли в UNKNOWN дольше ${input.staleAfterMinutes} мин`,
    );
  }

  return [
    "Системное предупреждение Ping My Site",
    ...problems.map((problem) => `- ${problem}`),
  ].join("\n");
}

export function buildAdminHealthRecoveredMessage(): string {
  return "Система Ping My Site снова в норме: worker жив, зависших UNKNOWN-мониторов нет.";
}
