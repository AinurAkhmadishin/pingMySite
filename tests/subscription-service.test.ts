import { SubscriptionCheckoutStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ADD_MONITOR_FUNNEL_STEPS } from "../src/modules/funnels/funnel.constants";
import { SubscriptionService } from "../src/modules/subscriptions/subscription.service";

vi.mock("../src/config/env", () => ({
  env: {
    TELEGRAM_STARS_MONTHLY_PRICE: 99,
  },
}));

describe("subscription service", () => {
  it("binds checkout to the funnel session and marks payment step", async () => {
    const repository = {
      expireStaleCheckouts: vi.fn().mockResolvedValue(undefined),
      createCheckout: vi.fn().mockResolvedValue({
        id: "checkout_1",
        userId: "user_1",
        funnelSessionId: "funnel_1",
        chatId: "123",
        invoicePayload: "stars-sub:test",
        status: SubscriptionCheckoutStatus.PENDING,
        planKey: "sub-30d",
        amountStars: 99,
        monitorDraft: null,
        createdMonitorId: null,
        paidAt: null,
        expiresAt: new Date("2026-04-11T00:00:00.000Z"),
        telegramPaymentChargeId: null,
        providerPaymentChargeId: null,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        user: {
          id: "user_1",
          telegramId: "tg_1",
        },
      }),
    };
    const telegram = {
      callApi: vi.fn().mockResolvedValue("https://t.me/pay"),
    };
    const funnelService = {
      setAddMonitorStep: vi.fn().mockResolvedValue(undefined),
      appendAddMonitorEvent: vi.fn(),
    };
    const service = new SubscriptionService(
      repository as never,
      {} as never,
      {} as never,
      telegram as never,
      funnelService as never,
    );

    await service.createSubscriptionCheckout({
      userId: "user_1",
      chatId: "123",
      funnelSessionId: "funnel_1",
      monitorDraft: {
        name: "Example",
        url: "https://example.com/",
        intervalMinutes: 5,
        timeoutMs: 5000,
        requiredText: null,
        checkSsl: false,
        checkJson: false,
        jsonRules: null,
        failureThreshold: 3,
        recoveryThreshold: 1,
      },
    });

    expect(repository.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        funnelSessionId: "funnel_1",
        amountStars: 99,
        planKey: "sub-30d",
      }),
    );
    expect(funnelService.setAddMonitorStep).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment,
      expect.objectContaining({
        amountStars: 99,
        hasMonitorDraft: true,
      }),
    );
    expect(telegram.callApi).toHaveBeenCalledWith(
      "createInvoiceLink",
      expect.objectContaining({
        currency: "XTR",
        subscription_period: 30 * 24 * 60 * 60,
      }),
    );
  });
});
