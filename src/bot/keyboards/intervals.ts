import { Markup } from "telegraf";

import { MONITOR_TERM_PLANS, SUPPORTED_INTERVALS } from "../../config/constants";

export function intervalKeyboard(prefix: string) {
  return Markup.inlineKeyboard(
    SUPPORTED_INTERVALS.map((value) => Markup.button.callback(`${value} \u043c\u0438\u043d`, `${prefix}:${value}`)),
    {
      columns: 2,
    },
  );
}

export function yesNoKeyboard(yesAction: string, noAction: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("\u0414\u0430", yesAction), Markup.button.callback("\u041d\u0435\u0442", noAction)],
  ]);
}

export function sensitivityKeyboard(prefix: string) {
  return Markup.inlineKeyboard(
    [3, 4, 5].map((value) =>
      Markup.button.callback(
        value === 3
          ? `${value} \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 (\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f)`
          : `${value} \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438`,
        `${prefix}:${value}`,
      ),
    ),
    {
      columns: 1,
    },
  );
}

export function monitorTermKeyboard(prefix: string) {
  return Markup.inlineKeyboard(
    MONITOR_TERM_PLANS.map((plan) =>
      Markup.button.callback(plan.label, `${plan.isAvailable ? prefix : `${prefix}-disabled`}:${plan.key}`),
    ),
    {
      columns: 2,
    },
  );
}
