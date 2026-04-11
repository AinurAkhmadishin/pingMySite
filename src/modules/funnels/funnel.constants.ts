export interface FunnelStepDefinition {
  key: string;
  label: string;
}

export const ADD_MONITOR_FUNNEL_STEPS = {
  awaitingPreset: {
    key: "awaiting_preset",
    label: "Вопрос: тип мониторинга",
  },
  awaitingUrl: {
    key: "awaiting_url",
    label: "Вопрос: URL сайта",
  },
  awaitingName: {
    key: "awaiting_name",
    label: "Вопрос: имя проекта",
  },
  awaitingInterval: {
    key: "awaiting_interval",
    label: "Вопрос: интервал мониторинга",
  },
  awaitingContentToggle: {
    key: "awaiting_content_toggle",
    label: "Вопрос: проверять обязательный текст",
  },
  awaitingContentText: {
    key: "awaiting_required_text",
    label: "Вопрос: обязательный текст",
  },
  awaitingSslToggle: {
    key: "awaiting_ssl_toggle",
    label: "Вопрос: SSL-проверка",
  },
  awaitingJsonToggle: {
    key: "awaiting_json_toggle",
    label: "Вопрос: JSON-валидация",
  },
  awaitingJsonRules: {
    key: "awaiting_json_rules",
    label: "Вопрос: JSON-правила",
  },
  awaitingSensitivity: {
    key: "awaiting_sensitivity",
    label: "Вопрос: чувствительность оповещений",
  },
  awaitingTermSelection: {
    key: "awaiting_term_selection",
    label: "Вопрос: тариф мониторинга",
  },
  awaitingSubscriptionPayment: {
    key: "awaiting_subscription_payment",
    label: "Шаг: ожидание оплаты подписки",
  },
  duplicateUrlBlocked: {
    key: "blocked_duplicate_url",
    label: "Стоп: URL уже добавлен",
  },
  invalidUrl: {
    key: "invalid_url",
    label: "Стоп: невалидный URL",
  },
  invalidJsonRules: {
    key: "invalid_json_rules",
    label: "Ошибка: невалидные JSON-правила",
  },
  draftResumed: {
    key: "draft_resumed",
    label: "Шаг: черновик продолжен",
  },
  draftRestarted: {
    key: "draft_restarted",
    label: "Шаг: опрос начат заново",
  },
  cancelledByUser: {
    key: "cancelled_by_user",
    label: "Стоп: опрос отменен пользователем",
  },
  trialSelected: {
    key: "trial_selected",
    label: "Ответ: выбран пробный период",
  },
  subscriptionSelected: {
    key: "subscription_selected",
    label: "Ответ: выбрана платная подписка",
  },
  subscriptionPreCheckoutApproved: {
    key: "subscription_precheckout_approved",
    label: "Шаг: pre-checkout подтвержден",
  },
  subscriptionPaymentSucceeded: {
    key: "subscription_payment_succeeded",
    label: "Шаг: подписка оплачена",
  },
  monitorCreated: {
    key: "monitor_created",
    label: "Финиш: монитор создан",
  },
  monitorCreationFailed: {
    key: "monitor_creation_failed",
    label: "Стоп: монитор не создан",
  },
} as const satisfies Record<string, FunnelStepDefinition>;

export type AddMonitorFunnelStep = (typeof ADD_MONITOR_FUNNEL_STEPS)[keyof typeof ADD_MONITOR_FUNNEL_STEPS];
