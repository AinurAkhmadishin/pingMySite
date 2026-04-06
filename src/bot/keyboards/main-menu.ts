import { Markup } from "telegraf";

import { BOT_MENU_TEXT } from "../../config/constants";

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [BOT_MENU_TEXT.add, BOT_MENU_TEXT.list],
    [BOT_MENU_TEXT.status, BOT_MENU_TEXT.report],
    [BOT_MENU_TEXT.settings, BOT_MENU_TEXT.help],
  ]).resize();
}
