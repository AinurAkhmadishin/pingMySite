import { MonitorState } from "@prisma/client";

import { formatDateTime, formatDurationSeconds, formatPercent } from "../../lib/date-time";
import { MonitorWithUser } from "../../modules/monitors/monitor.repository";
import { MonitorReport } from "../../modules/reports/report.service";

function formatState(state: MonitorState, isActive: boolean, billingLocked = false): string {
  if (billingLocked) {
    return "EXPIRED";
  }

  if (!isActive || state === MonitorState.PAUSED) {
    return "PAUSED";
  }

  if (state === MonitorState.DOWN) {
    return "DOWN";
  }

  if (state === MonitorState.UP) {
    return "UP";
  }

  return "UNKNOWN";
}

function formatMonitorEndDate(endsAt: Date | null | undefined, timeZone: string): string {
  return endsAt ? formatDateTime(endsAt, timeZone) : "без срока";
}

export function buildStartMessage(firstName?: string | null): string {
  return [
    `Привет${firstName ? `, ${firstName}` : ""}!`,
    "Я Ping My Site Bot и слежу за доступностью сайтов и API прямо в Telegram.",
    "Вы можете добавлять мониторы, получать уведомления о сбоях, смотреть uptime, историю инцидентов и контролировать SSL.",
    "Начните с команды /add или используйте кнопки меню ниже.",
  ].join("\n\n");
}

export function buildHelpMessage(): string {
  return [
    "Доступные команды:",
    "/start — приветствие и главное меню",
    "/help — список возможностей",
    "/add — добавить сайт или API на мониторинг",
    "/list — список всех мониторов",
    "/status — текущий статус всех мониторов",
    "/report — uptime и история инцидентов по монитору",
    "/pause — поставить монитор на паузу",
    "/resume — возобновить мониторинг",
    "/remove — удалить монитор",
    "/settings — изменить интервал, текст, JSON-правила, чувствительность и SSL",
    "/checknow — выполнить немедленную проверку",
    "/subscription — статус подписки и оплата через Stars",
    "/terms — условия оплаты",
    "/paysupport — поддержка по оплате",
    "",
    "Тарифы:",
    "1. Пробный период 14 дней",
    "2. Подписка на 30 дней через Telegram Stars",
    "",
    "Поддерживаются: HTTP/HTTPS-проверки, контроль текста на странице, JSON-валидация, SSL-уведомления и антифлаппинг.",
  ].join("\n");
}

export function buildMonitorListMessage(monitors: MonitorWithUser[]): string {
  if (monitors.length === 0) {
    return "У вас пока нет мониторов. Используйте /add, чтобы добавить первый сайт.";
  }

  return [
    "Ваши мониторы:",
    ...monitors.map((monitor, index) =>
      [
        `${index + 1}. ${monitor.name}`,
        `URL: ${monitor.url}`,
        `Состояние: ${formatState(monitor.currentState, monitor.isActive, monitor.billingLocked)}`,
        `Интервал: ${monitor.intervalMinutes} мин`,
        `Мониторинг до: ${formatMonitorEndDate(monitor.endsAt, monitor.user.timezone)}`,
        `Режим: ${monitor.isActive ? "активен" : "пауза"}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

export function buildStatusMessage(monitors: MonitorWithUser[]): string {
  if (monitors.length === 0) {
    return "Статусов пока нет: сначала добавьте хотя бы один монитор через /add.";
  }

  return [
    "Текущий статус мониторов:",
    ...monitors.map((monitor) =>
      [
        `${monitor.name} — ${formatState(monitor.currentState, monitor.isActive, monitor.billingLocked)}`,
        `URL: ${monitor.url}`,
        `Ответ: ${monitor.lastResponseTimeMs ?? "n/a"} ms`,
        `Последняя проверка: ${
          monitor.lastCheckedAt ? formatDateTime(monitor.lastCheckedAt, monitor.user.timezone) : "еще не выполнялась"
        }`,
        `HTTP-код: ${monitor.lastStatusCode ?? "n/a"}`,
        `Мониторинг до: ${formatMonitorEndDate(monitor.endsAt, monitor.user.timezone)}`,
        monitor.lastErrorMessage ? `Ошибка: ${monitor.lastErrorMessage}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

export function buildReportMessage(report: MonitorReport, timezone: string): string {
  const windows = report.windows.map(
    (window) => `${window.label}: ${formatPercent(window.uptimePercent)} (${window.successfulChecks}/${window.totalChecks})`,
  );

  const recentIncidents =
    report.recentIncidents.length > 0
      ? report.recentIncidents.map((incident, index) => {
          const duration =
            typeof incident.durationSeconds === "number" ? formatDurationSeconds(incident.durationSeconds) : "в процессе";

          return [
            `${index + 1}. ${incident.status}`,
            `Причина: ${incident.reason}`,
            `Начало: ${formatDateTime(incident.startedAt, timezone)}`,
            `Окончание: ${incident.resolvedAt ? formatDateTime(incident.resolvedAt, timezone) : "не завершен"}`,
            `Длительность: ${duration}`,
          ].join("\n");
        })
      : ["История инцидентов пока пустая."];

  return [
    `Отчет по монитору: ${report.monitorName}`,
    `URL: ${report.url}`,
    `Текущее состояние: ${report.currentState}`,
    `Мониторинг до: ${formatMonitorEndDate(report.endsAt, timezone)}`,
    ...windows,
    `Среднее время ответа: ${report.averageResponseTimeMs ?? "n/a"} ms`,
    `Всего инцидентов: ${report.totalIncidents}`,
    `Последний инцидент: ${report.lastIncidentReason ?? "нет"}`,
    report.lastIncidentStartedAt ? `Начался: ${formatDateTime(report.lastIncidentStartedAt, timezone)}` : "",
    report.openIncident ? "Сейчас есть открытый инцидент." : "Открытых инцидентов нет.",
    "",
    "Последние инциденты:",
    ...recentIncidents,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSettingsMenuMessage(monitor: MonitorWithUser): string {
  return [
    `Настройки монитора: ${monitor.name}`,
    `Интервал: ${monitor.intervalMinutes} мин`,
    `Мониторинг до: ${formatMonitorEndDate(monitor.endsAt, monitor.user.timezone)}`,
    `Обязательный текст: ${monitor.requiredText ?? "не задан"}`,
    `JSON-проверка: ${monitor.checkJson ? "включена" : "выключена"}`,
    `Чувствительность: ${monitor.failureThreshold} ошибки подряд`,
    `SSL-уведомления: ${monitor.checkSsl ? "включены" : "выключены"}`,
  ].join("\n");
}
