import { config } from "dotenv";
import { z } from "zod";

config();

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return defaultValue;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }

    return Boolean(value);
  }, z.boolean());

const numberFromEnv = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return defaultValue;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  }, z.number().int().min(min).max(max));

const optionalStringFromEnv = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return String(value);
  }, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_HOST: z.string().min(1).default("0.0.0.0"),
  APP_PORT: numberFromEnv(3000, 1, 65535),
  DASHBOARD_CORS_ORIGIN: z.string().min(1).default("*"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN обязателен"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обязателен"),
  REDIS_URL: z.string().min(1, "REDIS_URL обязателен"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Europe/Moscow"),
  DEFAULT_TIMEOUT_MS: numberFromEnv(5000, 1000, 30000),
  MAX_REDIRECTS: numberFromEnv(5, 0, 10),
  MAX_RESPONSE_BODY_BYTES: numberFromEnv(1024 * 1024, 1024, 5 * 1024 * 1024),
  MONITOR_USER_AGENT: z.string().min(3).default("PingMySiteBot/1.0"),
  BOT_POLLING: booleanFromEnv(true),
  CHECK_RETRY_COUNT: numberFromEnv(1, 0, 3),
  CHECK_RETRY_DELAY_MS: numberFromEnv(300, 0, 5000),
  CHECK_LOCK_TTL_SECONDS: numberFromEnv(60, 5, 300),
  MONITOR_WORKER_CONCURRENCY: numberFromEnv(10, 1, 50),
  INCIDENT_WORKER_CONCURRENCY: numberFromEnv(5, 1, 50),
  SSL_WORKER_CONCURRENCY: numberFromEnv(5, 1, 50),
  SUMMARY_WORKER_CONCURRENCY: numberFromEnv(2, 1, 10),
  WORKER_HEARTBEAT_INTERVAL_SECONDS: numberFromEnv(30, 5, 300),
  WORKER_HEARTBEAT_STALE_AFTER_SECONDS: numberFromEnv(90, 10, 900),
  UNKNOWN_MONITOR_STALE_AFTER_MINUTES: numberFromEnv(15, 1, 1440),
  UNKNOWN_MONITOR_SCAN_INTERVAL_SECONDS: numberFromEnv(60, 10, 3600),
  ENABLE_DAILY_SUMMARIES: booleanFromEnv(true),
  ENABLE_WEEKLY_SUMMARIES: booleanFromEnv(false),
  ENABLE_ACCESS_REMINDERS: booleanFromEnv(true),
  ACCESS_REMINDER_REPEAT_HOURS: numberFromEnv(12, 1, 48),
  MANUAL_CHECK_RATE_LIMIT_SECONDS: numberFromEnv(15, 1, 300),
  TELEGRAM_STARS_MONTHLY_PRICE: numberFromEnv(99, 1, 100000),
  FREE_MONITOR_LIMIT: numberFromEnv(1, 1, 100),
  FREE_MIN_INTERVAL_MINUTES: numberFromEnv(5, 1, 60),
  SUBSCRIPTION_MONITOR_LIMIT: numberFromEnv(50, 1, 1000),
  ENABLE_ADMIN_ALERTS: booleanFromEnv(false),
  ADMIN_TELEGRAM_CHAT_ID: optionalStringFromEnv(),
  ADMIN_ALERT_SCAN_INTERVAL_SECONDS: numberFromEnv(60, 10, 3600),
  PAYMENTS_TERMS_URL: optionalStringFromEnv(),
  PAYMENTS_SUPPORT_URL: optionalStringFromEnv(),
});

export const env = envSchema.parse(process.env);

export type AppEnv = typeof env;
