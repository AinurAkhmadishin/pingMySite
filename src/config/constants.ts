export const SUPPORTED_INTERVALS = [1, 5, 10, 15] as const;
export const SUPPORTED_TIMEOUTS = [3000, 5000, 10000, 15000] as const;
export const SSL_ALERT_THRESHOLDS = [30, 14, 7, 3, 1] as const;
export const ACCESS_REMINDER_THRESHOLDS = [3, 1] as const;
export const DAILY_SUMMARY_TIME_OPTIONS = [9 * 60, 10 * 60, 12 * 60, 18 * 60, 20 * 60] as const;
export const DEFAULT_DAILY_SUMMARY_TIME_MINUTES = DAILY_SUMMARY_TIME_OPTIONS[0];
export const DAILY_SUMMARY_DISPATCH_INTERVAL_MS = 60 * 1000;

export const ADD_MONITOR_PRESETS = [
  {
    key: "site",
    label: "Сайт",
    description: "Обычный сайт, блог или корпоративная страница.",
    suggestedUrl: "https://example.com",
    contentCheckRecommended: false,
    jsonCheckRecommended: false,
    defaultDraft: {
      checkSsl: true,
      checkJson: false,
    },
  },
  {
    key: "landing",
    label: "Лендинг",
    description: "Маркетинговая страница, где важен текст и SSL.",
    suggestedUrl: "https://promo.example.com",
    contentCheckRecommended: true,
    jsonCheckRecommended: false,
    defaultDraft: {
      checkSsl: true,
      checkJson: false,
    },
  },
  {
    key: "api-json",
    label: "API JSON",
    description: "JSON API с проверкой полей ответа.",
    suggestedUrl: "https://api.example.com/health",
    contentCheckRecommended: false,
    jsonCheckRecommended: true,
    defaultDraft: {
      checkSsl: false,
      checkJson: true,
    },
  },
  {
    key: "health",
    label: "Health endpoint",
    description: "Технический endpoint для быстрого мониторинга сервиса.",
    suggestedUrl: "https://example.com/health",
    contentCheckRecommended: false,
    jsonCheckRecommended: false,
    defaultDraft: {
      checkSsl: false,
      checkJson: false,
    },
  },
] as const;

export const MONITOR_TERM_PLANS = [
  {
    key: "trial-14d",
    label: "Пробный 14 дней",
    kind: "trial",
    isAvailable: true,
    days: 14,
  },
  {
    key: "sub-30d",
    label: "Подписка 30 дней",
    kind: "subscription",
    isAvailable: true,
    months: 1,
  },
] as const;

export const STARS_SUBSCRIPTION_PERIOD_SECONDS = 30 * 24 * 60 * 60;

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
  accessReminders: "access-reminders",
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
export type AddMonitorPreset = (typeof ADD_MONITOR_PRESETS)[number];
export type AddMonitorPresetKey = AddMonitorPreset["key"];
export type MonitorTermPlan = (typeof MONITOR_TERM_PLANS)[number];
export type MonitorTermKey = MonitorTermPlan["key"];
