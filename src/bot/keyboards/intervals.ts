import { Markup } from "telegraf";

import { SUPPORTED_INTERVALS } from "../../config/constants";

export function intervalKeyboard(prefix: string) {
  return Markup.inlineKeyboard(
    SUPPORTED_INTERVALS.map((value) => Markup.button.callback(`${value} мин`, `${prefix}:${value}`)),
    {
      columns: 2,
    },
  );
}

export function yesNoKeyboard(yesAction: string, noAction: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Да", yesAction), Markup.button.callback("Нет", noAction)],
  ]);
}

export function sensitivityKeyboard(prefix: string) {
  return Markup.inlineKeyboard(
    [3, 4, 5].map((value) =>
      Markup.button.callback(
        value === 3 ? `${value} проверки (рекомендуется)` : `${value} проверки`,
        `${prefix}:${value}`,
      ),
    ),
    {
      columns: 1,
    },
  );
}
