import { Markup } from "telegraf";

import { MonitorWithUser } from "../../modules/monitors/monitor.repository";

export function settingsKeyboard(monitor: MonitorWithUser) {
  const sslLabel = monitor.checkSsl ? "SSL: выключить" : "SSL: включить";

  return Markup.inlineKeyboard(
    [
      [
        Markup.button.callback("Интервал", `settings-interval:${monitor.id}`),
        Markup.button.callback("Таймаут", `settings-timeout:${monitor.id}`),
      ],
      [
        Markup.button.callback("Обязательный текст", `settings-text:${monitor.id}`),
        Markup.button.callback("JSON-правила", `settings-json:${monitor.id}`),
      ],
      [
        Markup.button.callback("Чувствительность", `settings-sensitivity:${monitor.id}`),
        Markup.button.callback(sslLabel, `settings-ssl:${monitor.id}`),
      ],
    ],
  );
}
