import { Markup } from "telegraf";

import {
  ADD_MONITOR_PRESETS,
  MONITOR_TERM_PLANS,
  SUPPORTED_INTERVALS,
  SupportedInterval,
} from "../../config/constants";

function navigationRow(options?: { includeBack?: boolean; includeCancel?: boolean }) {
  const buttons = [];

  if (options?.includeBack) {
    buttons.push(Markup.button.callback("Назад", "add-back"));
  }

  if (options?.includeCancel !== false) {
    buttons.push(Markup.button.callback("Отмена", "add-cancel"));
  }

  return buttons.length > 0 ? [buttons] : [];
}

export function addMonitorPresetKeyboard() {
  const rows = ADD_MONITOR_PRESETS.map((preset) => [
    Markup.button.callback(preset.label, `add-preset:${preset.key}`),
  ]);

  return Markup.inlineKeyboard([...rows, ...navigationRow({ includeCancel: true })]);
}

export function addMonitorTextStepKeyboard(includeBack = true) {
  return Markup.inlineKeyboard(navigationRow({ includeBack }));
}

export function addMonitorYesNoKeyboard(yesAction: string, noAction: string, includeBack = true) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Да", yesAction), Markup.button.callback("Нет", noAction)],
    ...navigationRow({ includeBack }),
  ]);
}

export function addMonitorIntervalKeyboard(values: readonly SupportedInterval[] = SUPPORTED_INTERVALS) {
  const rows = [];

  for (let index = 0; index < values.length; index += 2) {
    const slice = values.slice(index, index + 2);
    rows.push(slice.map((value) => Markup.button.callback(`${value} мин`, `add-interval:${value}`)));
  }

  return Markup.inlineKeyboard([...rows, ...navigationRow({ includeBack: true })]);
}

export function addMonitorSensitivityKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("3 проверки (рекомендуется)", "add-sensitivity:3"),
    ],
    [Markup.button.callback("4 проверки", "add-sensitivity:4")],
    [Markup.button.callback("5 проверок", "add-sensitivity:5")],
    ...navigationRow({ includeBack: true }),
  ]);
}

export function addMonitorTermKeyboard() {
  const rows = MONITOR_TERM_PLANS.map((plan) => [Markup.button.callback(plan.label, `add-duration:${plan.key}`)]);
  return Markup.inlineKeyboard([...rows, ...navigationRow({ includeBack: true })]);
}

export function addMonitorResumeKeyboard(sessionId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Продолжить", `add-resume-session:${sessionId}`)],
    [Markup.button.callback("Начать заново", `add-restart-session:${sessionId}`)],
    ...navigationRow({ includeCancel: true, includeBack: false }),
  ]);
}
