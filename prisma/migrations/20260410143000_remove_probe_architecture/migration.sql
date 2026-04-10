ALTER TABLE "CheckResult" DROP CONSTRAINT IF EXISTS "CheckResult_monitorProbeId_fkey";
ALTER TABLE "CheckResult" DROP CONSTRAINT IF EXISTS "CheckResult_probeId_fkey";
ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_monitorProbeId_fkey";
ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_probeId_fkey";
ALTER TABLE "NotificationLog" DROP CONSTRAINT IF EXISTS "NotificationLog_monitorProbeId_fkey";
ALTER TABLE "NotificationLog" DROP CONSTRAINT IF EXISTS "NotificationLog_probeId_fkey";
ALTER TABLE "MonitorProbe" DROP CONSTRAINT IF EXISTS "MonitorProbe_monitorId_fkey";
ALTER TABLE "MonitorProbe" DROP CONSTRAINT IF EXISTS "MonitorProbe_probeId_fkey";

DROP INDEX IF EXISTS "CheckResult_monitorProbeId_checkedAt_idx";
DROP INDEX IF EXISTS "CheckResult_probeId_checkedAt_idx";
DROP INDEX IF EXISTS "Incident_monitorProbeId_status_startedAt_idx";
DROP INDEX IF EXISTS "NotificationLog_monitorProbeId_type_sentAt_idx";
DROP INDEX IF EXISTS "MonitorProbe_monitorId_currentState_idx";
DROP INDEX IF EXISTS "MonitorProbe_probeId_currentState_idx";
DROP INDEX IF EXISTS "MonitorProbe_lastCheckedAt_idx";
DROP INDEX IF EXISTS "MonitorProbe_monitorId_probeId_key";
DROP INDEX IF EXISTS "Probe_key_key";
DROP INDEX IF EXISTS "Probe_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "Probe_regionCode_isActive_idx";

ALTER TABLE "CheckResult"
  DROP COLUMN IF EXISTS "monitorProbeId",
  DROP COLUMN IF EXISTS "probeId";

ALTER TABLE "Incident"
  DROP COLUMN IF EXISTS "monitorProbeId",
  DROP COLUMN IF EXISTS "probeId";

ALTER TABLE "NotificationLog"
  DROP COLUMN IF EXISTS "monitorProbeId",
  DROP COLUMN IF EXISTS "probeId";

DROP TABLE IF EXISTS "MonitorProbe";
DROP TABLE IF EXISTS "Probe";
