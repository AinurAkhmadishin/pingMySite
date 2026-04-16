# AGENTS.md

## Назначение проекта

- Это Telegram-бот для мониторинга сайтов и API.
- Основной пользовательский сценарий: пользователь добавляет монитор через Telegram, бот регулярно проверяет URL, фиксирует историю проверок, открывает и закрывает инциденты, присылает уведомления и отчеты.
- Проект монетизируется через Telegram Stars: есть trial и платная подписка.
- В репозитории также есть backend-API для health/dashboard-аналитики, но отдельного frontend dashboard в текущем состоянии репозитория нет.

## Источники правды

- Главный источник правды: `src/` + `prisma/schema.prisma` + `tests/`.
- `README.md` полезен как обзор, но в нескольких местах устарел.
- Не считать `README.md` источником истины без сверки с кодом.

## Актуальные технологии

- Node.js 20+
- TypeScript (`strict`, `commonjs`)
- Telegraf для Telegram-бота
- Express для API
- BullMQ + Redis для очередей и расписания
- Prisma + PostgreSQL для данных
- Undici для HTTP-проверок
- Zod для валидации env и схем
- Pino для логирования
- Vitest для тестов
- Docker / Docker Compose для локального окружения

## Точки входа

- `src/index.ts` - all-in-one запуск API + bot + workers
- `src/bin/api.ts` - только API
- `src/bin/bot.ts` - только Telegram bot
- `src/bin/worker.ts` - только workers

## Карта проекта

- `src/bot` - команды, callback handlers, сцены, клавиатуры, тексты
- `src/modules` - доменная логика
- `src/jobs` - BullMQ workers
- `src/queue` - очереди, job ids, расписания
- `src/api` - HTTP API для health/dashboard
- `src/config` - env и константы
- `src/lib` - URL/date/http/logger helpers
- `src/db` - Prisma client
- `prisma` - схема, миграции, seed
- `tests` - фактические контракты поведения

## Что проект делает по бизнес-логике

### Мониторы

- Один пользователь не может иметь два активных монитора на один и тот же нормализованный URL.
- URL нормализуется через `normalizeUrl()`:
  - если схема не указана, подставляется `https://`
  - поддерживаются только `http`/`https`
  - hash удаляется
  - пустой path превращается в `/`
- Удаление монитора мягкое: используется `deletedAt`, история проверок и инцидентов сохраняется.
- Resume и create всегда не только сохраняют монитор, но и синхронизируют расписание + запускают immediate/manual check.
- Для создания, pause/resume/remove нужно использовать `MonitorService`, а не ходить напрямую в repository.

### Интервалы и лимиты

- Поддерживаемые интервалы: `1`, `5`, `10`, `15` минут.
- Бесплатный режим ограничивается env:
  - `FREE_MONITOR_LIMIT` по умолчанию `1`
  - `FREE_MIN_INTERVAL_MINUTES` по умолчанию `5`
- Платный режим ограничивается `SUBSCRIPTION_MONITOR_LIMIT` по умолчанию `50`.

### Trial и подписка

- Trial-план: `14` дней.
- Subscription-план: `30` дней через Telegram Stars.
- Повторный trial на тот же URL блокируется на `6` месяцев с момента предыдущего trial.
- Платный монитор можно создать только при активной подписке.
- Для subscription-монитора `endsAt` всегда берется из `currentPeriodEnd` активной подписки.
- При истечении срока monitor не удаляется, а переводится в `billingLocked + PAUSED`.

### Состояния и инциденты

- Состояния: `UNKNOWN`, `UP`, `DOWN`, `PAUSED`.
- DOWN наступает после `failureThreshold` последовательных неудач. По умолчанию это `3`.
- Recovery сейчас фактически наступает после первого успешного чека.
- Поле `recoveryThreshold` хранится в модели, но текущая state machine его не использует.
- Инциденты создаются и закрываются не прямо из checker, а через очередь `incident-events`.
- При DOWN создается только один открытый инцидент на монитор.

### Проверки

- HTTP checker работает только методом `GET`.
- Есть retry только для части сетевых ошибок.
- Есть лимит на размер тела ответа: `MAX_RESPONSE_BODY_BYTES`.
- Поддерживается:
  - проверка обязательного текста
  - проверка JSON-правил
  - SSL expiration alerts
- Формат JSON-правил:
  - `status = ok`
  - `data.version exists`
- Manual check сейчас выполняется напрямую через `monitorCheckService.runManualCheck()`, а не через очередь.
- Manual check rate limit хранится в Redis.

### Уведомления и отчеты

- Telegram UX и тексты проекта русскоязычные. Это важно сохранять.
- Типы уведомлений логируются в `NotificationLog`.
- Есть DOWN, RECOVERED, SSL, MANUAL_CHECK, DAILY_SUMMARY, WEEKLY_SUMMARY.
- Uptime считается прозрачно: `successfulChecks / totalChecks * 100`.
- Отчеты по монитору строятся для окон `24h`, `7d`, `30d`.

### Daily / Weekly summary

- Daily summaries рассылаются worker'ом по минутному dispatch job.
- Важно: расписание daily summary сейчас живет в логике московского времени, а не в пользовательском timezone.
- `user.timezone` используется для форматирования дат в сообщениях, но не для вычисления времени отправки daily summary.
- Weekly summaries есть в коде, но по умолчанию выключены.
- Access reminders тоже рассылаются worker'ом и дедуплицируются через `AccessReminderLog`.

### Funnel / аналитика

- Добавление монитора - это воронка с сохранением шагов в `FunnelSession` и `FunnelEvent`.
- Незавершенный draft можно продолжить или начать заново.
- Оплата подписки привязана к funnel session и checkout.
- Analytics по funnel доступны через API.

## API

- `GET /` - простой статус сервиса
- `GET /health` - health API + worker heartbeat + stuck UNKNOWN monitors
- `GET /api/dashboard/overview`
- `GET /api/dashboard/monitors`
- `GET /api/dashboard/monitors/:monitorId`
- `GET /api/dashboard/funnel?days=30`

## Очереди и фоновые задачи

- `monitor-checks`
- `incident-events`
- `ssl-checks`
- `summary-jobs`

Workers:

- monitor check worker
- incident worker
- ssl worker
- summary worker

На старте workers:

- восстанавливают расписания активных мониторов
- пересоздают summary jobs
- запускают heartbeat в Redis
- отдельно следят за monitor'ами, застрявшими в `UNKNOWN`

## База данных

Основные сущности:

- `User`
- `Monitor`
- `CheckResult`
- `Incident`
- `NotificationLog`
- `SslAlertLog`
- `UserSubscription`
- `SubscriptionCheckout`
- `SubscriptionPayment`
- `FunnelSession`
- `FunnelEvent`
- `AccessReminderLog`

## Практические правила для будущих правок

- Сохранять русскоязычный UX бота.
- Изменения в мониторинге делать через сервисный слой, чтобы не сломать расписания и side effects.
- При изменении логики создания/возобновления монитора обязательно проверять:
  - лимиты free/subscription
  - нормализацию URL
  - schedule sync
  - immediate/manual check
  - funnel analytics
- При изменении state machine обязательно обновлять тесты `incident-state` и связанные сервисы.
- Не предполагать, что `recoveryThreshold` реально работает, пока не будет доработана state machine.
- Не предполагать наличие multi-probe архитектуры: она уже удалена из схемы, но следы остались в коде dashboard.
- Не реанимировать `probes`/region logic частично: если возвращать, то только целостно через schema + workers + API + tests.
- Если правка затрагивает daily summaries, помнить, что сейчас логика завязана на Москву (`Europe/Moscow` / MSK).
- Для env-параметров ориентироваться на `src/config/env.ts`, а не только на `.env.example`.

## Важные расхождения и технический долг

- В `package.json` есть `dashboard:dev` и `dashboard:build`, но директории `dashboard/` в репозитории сейчас нет.
- В `README.md` есть описание отдельного React dashboard, но фактически frontend dashboard отсутствует.
- В `src/modules/dashboard/dashboard.service.ts` остались типы и поля под legacy probe architecture, но сейчас они возвращают пустые массивы / `null`.
- Папка `src/modules/probes` существует, но по факту пустая.
- `.env.example` не отражает весь набор переменных из `src/config/env.ts`.

## Полезные команды

- `npm install`
- `npm test`
- `npm run build`
- `npm run check`
- `npm run dev`
- `npm run dev:api`
- `npm run dev:bot`
- `npm run dev:worker`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:seed`
- `docker compose up -d postgres redis`

## Тесты, на которые особенно полезно опираться

- `tests/add-monitor.scene.test.ts`
- `tests/monitor-service.test.ts`
- `tests/incident-state.test.ts`
- `tests/subscription-service.test.ts`
- `tests/summary.service.test.ts`
- `tests/dashboard.service.test.ts`
- `tests/monitor-messages.test.ts`

## Краткое резюме для себя

- Это не просто ping bot, а Telegram-first SaaS для мониторинга с trial, подпиской, воронкой и аналитикой.
- Самые чувствительные места: add-monitor flow, payment/subscription flow, state machine, queues, summary scheduling.
- При любых спорных моментах сверяться сначала с тестами и сервисами, а README считать вторичным источником.
