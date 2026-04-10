-- CreateEnum
CREATE TYPE "UserSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionCheckoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Monitor" ADD COLUMN     "billingLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "planKey" TEXT NOT NULL,
    "amountStars" INTEGER NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "lastInvoicePayload" TEXT,
    "lastTelegramPaymentChargeId" TEXT,
    "lastProviderPaymentChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCheckout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "invoicePayload" TEXT NOT NULL,
    "status" "SubscriptionCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "planKey" TEXT NOT NULL,
    "amountStars" INTEGER NOT NULL,
    "monitorDraft" JSONB,
    "createdMonitorId" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "telegramPaymentChargeId" TEXT,
    "providerPaymentChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userSubscriptionId" TEXT,
    "invoicePayload" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountStars" INTEGER NOT NULL,
    "telegramPaymentChargeId" TEXT NOT NULL,
    "providerPaymentChargeId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isFirstRecurring" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "createdMonitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "UserSubscription_status_currentPeriodEnd_idx" ON "UserSubscription"("status", "currentPeriodEnd" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCheckout_invoicePayload_key" ON "SubscriptionCheckout"("invoicePayload");

-- CreateIndex
CREATE INDEX "SubscriptionCheckout_userId_status_createdAt_idx" ON "SubscriptionCheckout"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_telegramPaymentChargeId_key" ON "SubscriptionPayment"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_createdAt_idx" ON "SubscriptionPayment"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SubscriptionPayment_invoicePayload_createdAt_idx" ON "SubscriptionPayment"("invoicePayload", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCheckout" ADD CONSTRAINT "SubscriptionCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userSubscriptionId_fkey" FOREIGN KEY ("userSubscriptionId") REFERENCES "UserSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

