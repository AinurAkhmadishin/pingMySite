# Ping My Site Bot

Ping My Site Bot is a production-ready Telegram bot for website and API monitoring. It lets users add monitors from Telegram, runs scheduled checks via BullMQ, stores history in PostgreSQL through Prisma, sends incident and recovery notifications, tracks SSL expiration, and builds uptime reports.

## Features

- Monitoring of websites and API endpoints over HTTP/HTTPS
- Telegram UX in Russian with `/start`, `/help`, `/add`, `/list`, `/status`, `/report`, `/pause`, `/resume`, `/remove`, `/settings`, `/checknow`
- Guided monitor creation flow in Telegram
- Incident detection with false-positive protection: by default 3 consecutive failures before DOWN and 1 success for recovery
- Content matching for HTML/text responses
- JSON response validation by field path and expected value
- SSL certificate expiration alerts with threshold deduplication
- Background workers for scheduled checks, incident processing, SSL checks, daily summaries, and weekly summaries
- Uptime reports for 24 hours, 7 days, and 30 days
- Soft-delete of monitors with preserved historical data
- Separate React dashboard for database-backed monitoring analytics
- Docker, Docker Compose, Prisma schema, migrations, tests, and structured logging

## Architecture Overview

The repository is split into clear layers:

- `src/bot` contains Telegram commands, handlers, keyboards, and conversational flows
- `src/modules` contains business logic for monitors, checks, incidents, notifications, reports, SSL, and users
- `src/queue` contains BullMQ queue integration and scheduler logic
- `src/jobs` contains queue workers
- `src/api` exposes health endpoints
- `dashboard` contains the separate React dashboard application
- `src/db` contains Prisma client wiring
- `src/config` validates environment variables with Zod
- `prisma` contains the schema, seed script, and migrations

Main runtime pieces:

- Telegram bot process for user interaction
- API process for health endpoints
- Worker process for check execution and background processing
- PostgreSQL for persistent monitor data
- Redis for BullMQ jobs and locking

## Folder Structure

```text
src/
  api/
  app/
  bin/
  bot/
    commands/
    handlers/
    keyboards/
    middlewares/
    messages/
    scenes/
  config/
  db/
  jobs/
  lib/
  modules/
    checks/
    incidents/
    monitors/
    notifications/
    reports/
    ssl/
    users/
  queue/
  types/
prisma/
dashboard/
tests/
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Prepare environment

```bash
cp .env.example .env
```

Fill in at least:

- `BOT_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`

### 3. Start PostgreSQL and Redis

Use Docker for local dependencies:

```bash
docker compose up -d postgres redis
```

### 4. Run migrations

```bash
npm run prisma:deploy
```

For local development with a live database you can also use:

```bash
npm run prisma:migrate
```

### 5. Start services locally

All-in-one mode:

```bash
npm run dev
```

Separate processes:

```bash
npm run dev:api
npm run dev:bot
npm run dev:worker
npm run dashboard:dev
```

The React dashboard runs from the separate `dashboard/` directory and reads monitoring data from the existing API.

## Docker Setup

### Build and start

```bash
docker compose build
docker compose up -d postgres redis
docker compose run --rm migrate
docker compose up -d api bot worker
```

### Services in Compose

- `postgres` - PostgreSQL database
- `redis` - Redis for BullMQ
- `api` - Express health API
- `bot` - Telegram bot process
- `worker` - BullMQ workers
- `migrate` - one-off migration runner

## Environment Variables

The project validates configuration on startup with Zod.

Important variables:

- `BOT_TOKEN` - Telegram bot token
- `DATABASE_URL` - PostgreSQL DSN
- `REDIS_URL` - Redis DSN
- `APP_HOST` / `APP_PORT` - Express API bind address
- `DASHBOARD_CORS_ORIGIN` - allowed origin for the React dashboard, default `*`
- `DEFAULT_TIMEOUT_MS` - default HTTP timeout for monitors
- `MAX_REDIRECTS` - maximum redirects for HTTP checks
- `MONITOR_USER_AGENT` - user-agent header used by checks
- `BOT_POLLING` - enable polling mode in development
- `ENABLE_DAILY_SUMMARIES` - toggle daily summary jobs
- `ENABLE_WEEKLY_SUMMARIES` - toggle weekly summary jobs

See the full list in [.env.example](/D:/pingBotTg/.env.example).

## Database Migrations

Prisma schema lives in [prisma/schema.prisma](/D:/pingBotTg/prisma/schema.prisma).

Common commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

Optional demo seed:

```bash
SEED_TELEGRAM_ID=123456 npm run prisma:seed
```

## Running the Bot

Polling mode is enabled by default through `BOT_POLLING=true`, which makes local start easy. The code is structured so webhook mode can be added later by extending [src/bot/app.ts](/D:/pingBotTg/src/bot/app.ts) without changing core business logic.

Commands supported:

- `/start`
- `/help`
- `/add`
- `/list`
- `/status`
- `/report`
- `/pause`
- `/resume`
- `/remove`
- `/settings`
- `/checknow`

## Running Workers

The worker process starts four main worker types:

- scheduled monitor check worker
- incident processing worker
- SSL check worker
- summary worker

The scheduler restores active monitor repeat jobs on worker startup and keeps BullMQ schedules in Redis.

## Monitoring Logic

- HTTP/HTTPS checks use `GET` by default and are implemented in [src/modules/checks/http-checker.ts](/D:/pingBotTg/src/modules/checks/http-checker.ts)
- A monitor is considered DOWN after the configured number of consecutive failures, default `3`
- A DOWN monitor is considered recovered after one successful check
- Content mismatch and JSON mismatch are treated as failed checks
- SSL alerts are deduplicated per threshold and certificate expiration date
- Uptime is calculated transparently as `successfulChecks / totalChecks * 100`

## Production Notes

- Run bot, API, and workers as separate processes
- Run the React dashboard separately with `npm --prefix dashboard run build` and serve `dashboard/dist`
- Keep PostgreSQL and Redis persistent
- Use `prisma migrate deploy` during deployment
- Consider a process manager or orchestrator for restart policies
- For large workloads, raise worker concurrency and split queues by responsibility
- Webhook mode can be added later if polling is not desired in production

## Testing

Run unit tests:

```bash
npm test
```

Covered logic:

- incident opening after 3 consecutive failures
- recovery flow
- uptime calculation
- content matching
- JSON validation
- monitor creation validation

## Future Improvements

- project tags for monitors
- team/shared monitors and group notifications
- maintenance mode
- CSV export for incident history
- per-user timezone editing from Telegram
- webhook delivery mode
- paid plans and limits

## React Dashboard

The repository now includes a standalone React dashboard in [dashboard/package.json](/D:/pingBotTg/dashboard/package.json).

Useful commands:

```bash
npm run dashboard:dev
npm run dashboard:build
```

The dashboard reads data from these API endpoints:

- `GET /api/dashboard/overview`
- `GET /api/dashboard/monitors`
- `GET /api/dashboard/monitors/:monitorId`

The API keeps CORS open through `DASHBOARD_CORS_ORIGIN`, so the dashboard can run on a separate port such as Vite's default `5173`.
