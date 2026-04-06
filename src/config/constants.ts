export const SUPPORTED_INTERVALS = [1, 5, 10, 15] as const;
export const SUPPORTED_TIMEOUTS = [3000, 5000, 10000, 15000] as const;
export const SSL_ALERT_THRESHOLDS = [30, 14, 7, 3, 1] as const;

export const DEFAULT_FAILURE_THRESHOLD = 3;
export const DEFAULT_RECOVERY_THRESHOLD = 1;

export const QUEUE_NAMES = {
  monitorChecks: "monitor-checks",
  incidents: "incident-events",
  ssl: "ssl-checks",
  summaries: "summary-jobs",
} as const;

export const JOB_NAMES = {
  scheduledMonitorCheck: "scheduled-monitor-check",
  manualMonitorCheck: "manual-monitor-check",
  incidentTransition: "incident-transition",
  sslCheck: "ssl-check",
  dailySummary: "daily-summary",
  weeklySummary: "weekly-summary",
} as const;

export const BOT_MENU_TEXT = {
  add: "Добавить",
  list: "Список",
  status: "Статус",
  report: "Отчет",
  settings: "Настройки",
  help: "Помощь",
} as const;

export const REPORT_WINDOWS = [
  {
    key: "24h",
    hours: 24,
  },
  {
    key: "7d",
    hours: 24 * 7,
  },
  {
    key: "30d",
    hours: 24 * 30,
  },
] as const;

export type SupportedInterval = (typeof SUPPORTED_INTERVALS)[number];
