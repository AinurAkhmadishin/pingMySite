export const SUPPORTED_INTERVALS = [1, 5, 10, 15] as const;
export const SUPPORTED_TIMEOUTS = [3000, 5000, 10000, 15000] as const;
export const SSL_ALERT_THRESHOLDS = [30, 14, 7, 3, 1] as const;
export const MONITOR_TERM_PLANS = [
  {
    key: "trial-14d",
    label: "\u041f\u0440\u043e\u0431\u043d\u044b\u0439 14 \u0434\u043d\u0435\u0439",
    kind: "trial",
    isAvailable: true,
    days: 14,
  },
  {
    key: "sub-1m",
    label: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 1 \u043c\u0435\u0441\u044f\u0446 (\u0441\u043a\u043e\u0440\u043e)",
    kind: "subscription",
    isAvailable: false,
    months: 1,
  },
  {
    key: "sub-3m",
    label: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 3 \u043c\u0435\u0441\u044f\u0446\u0430 (\u0441\u043a\u043e\u0440\u043e)",
    kind: "subscription",
    isAvailable: false,
    months: 3,
  },
  {
    key: "sub-6m",
    label: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 6 \u043c\u0435\u0441\u044f\u0446\u0435\u0432 (\u0441\u043a\u043e\u0440\u043e)",
    kind: "subscription",
    isAvailable: false,
    months: 6,
  },
  {
    key: "sub-1y",
    label: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 1 \u0433\u043e\u0434 (\u0441\u043a\u043e\u0440\u043e)",
    kind: "subscription",
    isAvailable: false,
    months: 12,
  },
] as const;

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
export type MonitorTermPlan = (typeof MONITOR_TERM_PLANS)[number];
export type MonitorTermKey = MonitorTermPlan["key"];
