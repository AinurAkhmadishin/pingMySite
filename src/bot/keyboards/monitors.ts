import { Markup } from "telegraf";

import { MonitorWithUser } from "../../modules/monitors/monitor.repository";

export function monitorSelectionKeyboard(monitors: MonitorWithUser[], prefix: string) {
  return Markup.inlineKeyboard(
    monitors.map((monitor) => [Markup.button.callback(monitor.name, `${prefix}:${monitor.id}`)]),
  );
}

export function removeConfirmationKeyboard(monitorId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Да, удалить", `remove-confirm:${monitorId}`),
      Markup.button.callback("Отмена", "noop"),
    ],
  ]);
}
