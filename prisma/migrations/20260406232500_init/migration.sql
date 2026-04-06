-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MonitorState" AS ENUM ('UNKNOWN', 'UP', 'DOWN', 'PAUSED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DOWN', 'RECOVERED', 'SSL_EXPIRING', 'MANUAL_CHECK', 'DAILY_SUMMARY', 'WEEKLY_SUMMARY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "failureThreshold" INTEGER NOT NULL DEFAULT 3,
    "recoveryThreshold" INTEGER NOT NULL DEFAULT 1,
    "currentState" "MonitorState" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "lastResponseTimeMs" INTEGER,
    "lastErrorMessage" TEXT,
    "requiredText" TEXT,
    "checkSsl" BOOLEAN NOT NULL DEFAULT false,
    "checkJson" BOOLEAN NOT NULL DEFAULT false,
    "jsonRules" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckResult" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "errorMessage" TEXT,
    "contentMatched" BOOLEAN,
    "jsonMatched" BOOLEAN,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "openedAfterFailures" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SslAlertLog" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SslAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Monitor_userId_isActive_deletedAt_idx" ON "Monitor"("userId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Monitor_currentState_isActive_idx" ON "Monitor"("currentState", "isActive");

-- CreateIndex
CREATE INDEX "Monitor_normalizedUrl_idx" ON "Monitor"("normalizedUrl");

-- CreateIndex
CREATE INDEX "CheckResult_monitorId_checkedAt_idx" ON "CheckResult"("monitorId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "CheckResult_success_checkedAt_idx" ON "CheckResult"("success", "checkedAt");

-- CreateIndex
CREATE INDEX "Incident_monitorId_status_startedAt_idx" ON "Incident"("monitorId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Incident_status_startedAt_idx" ON "Incident"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "SslAlertLog_monitorId_sentAt_idx" ON "SslAlertLog"("monitorId", "sentAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SslAlertLog_monitorId_thresholdDays_expiresAt_key" ON "SslAlertLog"("monitorId", "thresholdDays", "expiresAt");

-- CreateIndex
CREATE INDEX "NotificationLog_monitorId_type_sentAt_idx" ON "NotificationLog"("monitorId", "type", "sentAt" DESC);

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SslAlertLog" ADD CONSTRAINT "SslAlertLog_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

