export function buildSupportMessage(): string {
  return [
    "Поддержка",
    "Напишите в Telegram: @Bash_Coder",
    "По возможности сразу приложите URL монитора и короткое описание проблемы.",
  ].join("\n");
}

export function buildSupportUnavailableMessage(): string {
  return [
    "Поддержка через бота доступна пользователям, у которых уже подключен мониторинг.",
    "Сначала добавьте сайт или API через /add.",
  ].join("\n");
}
