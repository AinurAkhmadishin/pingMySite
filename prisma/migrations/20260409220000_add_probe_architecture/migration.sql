-- CreateTable
CREATE TABLE "Probe" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Probe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorProbe" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "probeId" TEXT NOT NULL,
    "currentState" "MonitorState" NOT NULL DEFAULT 'UNKNOWN',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "lastResponseTimeMs" INTEGER,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorProbe_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CheckResult"
ADD COLUMN "monitorProbeId" TEXT,
ADD COLUMN "probeId" TEXT;

-- AlterTable
ALTER TABLE "Incident"
ADD COLUMN "monitorProbeId" TEXT,
ADD COLUMN "probeId" TEXT;

-- AlterTable
ALTER TABLE "NotificationLog"
ADD COLUMN "monitorProbeId" TEXT,
ADD COLUMN "probeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Probe_key_key" ON "Probe"("key");

-- CreateIndex
CREATE INDEX "Probe_isActive_sortOrder_idx" ON "Probe"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Probe_regionCode_isActive_idx" ON "Probe"("regionCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorProbe_monitorId_probeId_key" ON "MonitorProbe"("monitorId", "probeId");

-- CreateIndex
CREATE INDEX "MonitorProbe_monitorId_currentState_idx" ON "MonitorProbe"("monitorId", "currentState");

-- CreateIndex
CREATE INDEX "MonitorProbe_probeId_currentState_idx" ON "MonitorProbe"("probeId", "currentState");

-- CreateIndex
CREATE INDEX "MonitorProbe_lastCheckedAt_idx" ON "MonitorProbe"("lastCheckedAt" DESC);

-- CreateIndex
CREATE INDEX "CheckResult_monitorProbeId_checkedAt_idx" ON "CheckResult"("monitorProbeId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "CheckResult_probeId_checkedAt_idx" ON "CheckResult"("probeId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "Incident_monitorProbeId_status_startedAt_idx" ON "Incident"("monitorProbeId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationLog_monitorProbeId_type_sentAt_idx" ON "NotificationLog"("monitorProbeId", "type", "sentAt" DESC);

-- AddForeignKey
ALTER TABLE "MonitorProbe" ADD CONSTRAINT "MonitorProbe_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorProbe" ADD CONSTRAINT "MonitorProbe_probeId_fkey" FOREIGN KEY ("probeId") REFERENCES "Probe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_monitorProbeId_fkey" FOREIGN KEY ("monitorProbeId") REFERENCES "MonitorProbe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_probeId_fkey" FOREIGN KEY ("probeId") REFERENCES "Probe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_monitorProbeId_fkey" FOREIGN KEY ("monitorProbeId") REFERENCES "MonitorProbe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_probeId_fkey" FOREIGN KEY ("probeId") REFERENCES "Probe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_monitorProbeId_fkey" FOREIGN KEY ("monitorProbeId") REFERENCES "MonitorProbe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_probeId_fkey" FOREIGN KEY ("probeId") REFERENCES "Probe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default probes
INSERT INTO "Probe" ("id", "key", "name", "regionCode", "description", "isActive", "isDefault", "sortOrder", "createdAt", "updatedAt")
VALUES
    ('probe_ru', 'ru', 'Россия', 'RU', 'Проверка из российской сети', true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('probe_global', 'global', 'За рубежом', 'GLOBAL', 'Проверка из зарубежной сети', true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Backfill monitor-probe assignments for existing monitors
INSERT INTO "MonitorProbe" (
    "id",
    "monitorId",
    "probeId",
    "currentState",
    "consecutiveFailures",
    "lastCheckedAt",
    "lastStatusCode",
    "lastResponseTimeMs",
    "lastErrorMessage",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('monitor_probe_', md5("Monitor"."id" || ':' || "Probe"."id")),
    "Monitor"."id",
    "Probe"."id",
    "Monitor"."currentState",
    "Monitor"."consecutiveFailures",
    "Monitor"."lastCheckedAt",
    "Monitor"."lastStatusCode",
    "Monitor"."lastResponseTimeMs",
    "Monitor"."lastErrorMessage",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Monitor"
CROSS JOIN "Probe"
WHERE "Probe"."isDefault" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "MonitorProbe"
    WHERE "MonitorProbe"."monitorId" = "Monitor"."id"
      AND "MonitorProbe"."probeId" = "Probe"."id"
  );
