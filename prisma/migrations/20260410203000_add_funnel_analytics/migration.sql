-- CreateEnum
CREATE TYPE "FunnelSessionKind" AS ENUM ('ADD_MONITOR');

-- CreateEnum
CREATE TYPE "FunnelSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED', 'ABANDONED');

-- AlterTable
ALTER TABLE "SubscriptionCheckout" ADD COLUMN "funnelSessionId" TEXT;

-- CreateTable
CREATE TABLE "FunnelSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FunnelSessionKind" NOT NULL,
    "status" "FunnelSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStepKey" TEXT NOT NULL,
    "currentStepLabel" TEXT NOT NULL,
    "lastEventPayload" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepLabel" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionCheckout_funnelSessionId_createdAt_idx" ON "SubscriptionCheckout"("funnelSessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FunnelSession_userId_kind_status_lastEventAt_idx" ON "FunnelSession"("userId", "kind", "status", "lastEventAt" DESC);

-- CreateIndex
CREATE INDEX "FunnelSession_status_lastEventAt_idx" ON "FunnelSession"("status", "lastEventAt" DESC);

-- CreateIndex
CREATE INDEX "FunnelEvent_sessionId_createdAt_idx" ON "FunnelEvent"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_stepKey_createdAt_idx" ON "FunnelEvent"("userId", "stepKey", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SubscriptionCheckout" ADD CONSTRAINT "SubscriptionCheckout_funnelSessionId_fkey" FOREIGN KEY ("funnelSessionId") REFERENCES "FunnelSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelSession" ADD CONSTRAINT "FunnelSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FunnelSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
