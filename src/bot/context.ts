import { User } from "@prisma/client";

import { BotContext } from "../types/bot";

export function getCurrentUserOrThrow(ctx: BotContext): User {
  if (!ctx.state.currentUser) {
    throw new Error("Пользователь Telegram не инициализирован.");
  }

  return ctx.state.currentUser;
}
