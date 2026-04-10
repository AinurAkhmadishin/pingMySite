import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppServices } from "../src/app/services";
import { DEFAULT_FAILURE_THRESHOLD } from "../src/config/constants";
import { ADD_MONITOR_FUNNEL_STEPS } from "../src/modules/funnels/funnel.constants";
import { BotContext } from "../src/types/bot";

vi.mock("../src/config/env", () => ({
  env: {
    DEFAULT_TIMEOUT_MS: 5000,
    TELEGRAM_STARS_MONTHLY_PRICE: 99,
    PAYMENTS_TERMS_URL: undefined,
    PAYMENTS_SUPPORT_URL: undefined,
  },
}));

let startAddMonitorFlow: typeof import("../src/bot/scenes/add-monitor.scene").startAddMonitorFlow;
let handleAddMonitorText: typeof import("../src/bot/scenes/add-monitor.scene").handleAddMonitorText;
let handleAddMonitorCallback: typeof import("../src/bot/scenes/add-monitor.scene").handleAddMonitorCallback;

beforeAll(async () => {
  ({ startAddMonitorFlow, handleAddMonitorText, handleAddMonitorCallback } = await import(
    "../src/bot/scenes/add-monitor.scene"
  ));
});

function createContext(text: string): { ctx: BotContext; reply: ReturnType<typeof vi.fn> } {
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    ctx: {
      message: { text },
      reply,
      session: {
        flow: {
          kind: "add",
          funnelSessionId: "funnel_1",
          step: "url",
          draft: {
            checkJson: false,
            checkSsl: false,
            failureThreshold: DEFAULT_FAILURE_THRESHOLD,
          },
        },
      },
      state: {
        currentUser: {
          id: "user_1",
          telegramId: "tg_1",
        },
      },
    } as unknown as BotContext,
    reply,
  };
}

function createServices(existingMonitor: unknown): {
  services: AppServices;
  findExistingMonitorByUrl: ReturnType<typeof vi.fn>;
  createMonitor: ReturnType<typeof vi.fn>;
  createSubscriptionCheckout: ReturnType<typeof vi.fn>;
  getActiveSubscriptionForUser: ReturnType<typeof vi.fn>;
  startAddMonitorSession: ReturnType<typeof vi.fn>;
  setAddMonitorStep: ReturnType<typeof vi.fn>;
  appendAddMonitorEvent: ReturnType<typeof vi.fn>;
  completeAddMonitorSession: ReturnType<typeof vi.fn>;
  stopAddMonitorSession: ReturnType<typeof vi.fn>;
} {
  const findExistingMonitorByUrl = vi.fn().mockResolvedValue(existingMonitor);
  const createMonitor = vi.fn().mockResolvedValue({
    id: "monitor_1",
    name: "Example",
    url: "https://example.com/",
    intervalMinutes: 5,
    endsAt: new Date("2026-05-24T10:00:00.000Z"),
    checkSsl: false,
    checkJson: false,
  });
  const createSubscriptionCheckout = vi.fn().mockResolvedValue({
    amountStars: 99,
    paymentUrl: "https://t.me/pay",
  });
  const getActiveSubscriptionForUser = vi.fn().mockResolvedValue(null);
  const startAddMonitorSession = vi.fn().mockResolvedValue({ id: "funnel_new" });
  const setAddMonitorStep = vi.fn().mockResolvedValue(undefined);
  const appendAddMonitorEvent = vi.fn().mockResolvedValue(undefined);
  const completeAddMonitorSession = vi.fn().mockResolvedValue(undefined);
  const stopAddMonitorSession = vi.fn().mockResolvedValue(undefined);

  return {
    services: {
      monitorService: {
        findExistingMonitorByUrl,
        createMonitor,
      },
      subscriptionService: {
        createSubscriptionCheckout,
        getActiveSubscriptionForUser,
      },
      funnelService: {
        startAddMonitorSession,
        setAddMonitorStep,
        appendAddMonitorEvent,
        completeAddMonitorSession,
        stopAddMonitorSession,
      },
    } as unknown as AppServices,
    findExistingMonitorByUrl,
    createMonitor,
    createSubscriptionCheckout,
    getActiveSubscriptionForUser,
    startAddMonitorSession,
    setAddMonitorStep,
    appendAddMonitorEvent,
    completeAddMonitorSession,
    stopAddMonitorSession,
  };
}

function createCallbackContext(data: string): {
  ctx: BotContext;
  answerCbQuery: ReturnType<typeof vi.fn>;
  reply: ReturnType<typeof vi.fn>;
} {
  const answerCbQuery = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    ctx: {
      callbackQuery: { data },
      answerCbQuery,
      reply,
      chat: {
        id: 123,
      },
      session: {
        flow: {
          kind: "add",
          funnelSessionId: "funnel_1",
          step: "duration",
          draft: {
            url: "https://example.com/",
            name: "Example",
            intervalMinutes: 5,
            checkJson: false,
            checkSsl: false,
            failureThreshold: DEFAULT_FAILURE_THRESHOLD,
          },
        },
      },
      state: {
        currentUser: {
          id: "user_1",
          telegramId: "tg_1",
          timezone: "Europe/Moscow",
        },
      },
    } as unknown as BotContext,
    answerCbQuery,
    reply,
  };
}

describe("add monitor scene", () => {
  it("starts a new funnel session when the add flow begins", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const { services, startAddMonitorSession } = createServices(null);
    const ctx = {
      reply,
      session: {},
      state: {
        currentUser: {
          id: "user_1",
          telegramId: "tg_1",
        },
      },
    } as unknown as BotContext;

    await startAddMonitorFlow(ctx, services);

    expect(startAddMonitorSession).toHaveBeenCalledWith("user_1");
    expect(ctx.session.flow).toMatchObject({
      kind: "add",
      funnelSessionId: "funnel_new",
      step: "url",
    });
  });

  it("stops the flow immediately when the url already exists for the current user", async () => {
    const { ctx, reply } = createContext("example.com");
    const { services, findExistingMonitorByUrl, stopAddMonitorSession } = createServices({ id: "monitor_1" });

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).toHaveBeenCalledWith("user_1", "https://example.com/");
    expect(stopAddMonitorSession).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.duplicateUrlBlocked,
      expect.objectContaining({
        url: "https://example.com/",
      }),
    );
    expect(ctx.session.flow).toBeUndefined();
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("Опрос остановлен");
  });

  it("stops the flow and warns when the site address is invalid", async () => {
    const { ctx, reply } = createContext("example");
    const { services, findExistingMonitorByUrl, stopAddMonitorSession } = createServices(null);

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).not.toHaveBeenCalled();
    expect(stopAddMonitorSession).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.invalidUrl,
      expect.objectContaining({
        rawUrl: "example",
      }),
    );
    expect(ctx.session.flow).toBeUndefined();
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("Опрос остановлен");
  });

  it("moves to the name step when the url is unique", async () => {
    const { ctx } = createContext("example.com");
    const { services, findExistingMonitorByUrl, setAddMonitorStep } = createServices(null);

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).toHaveBeenCalledWith("user_1", "https://example.com/");
    expect(setAddMonitorStep).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.awaitingName,
      {
        url: "https://example.com/",
      },
    );
    expect(ctx.session.flow).toMatchObject({
      kind: "add",
      step: "name",
    });
    expect((ctx.session.flow as Extract<BotContext["session"]["flow"], { kind: "add" }>).draft.url).toBe(
      "https://example.com/",
    );
  });

  it("starts Stars checkout when paid term is selected without an active subscription", async () => {
    const { ctx, answerCbQuery, reply } = createCallbackContext("add-duration:sub-30d");
    const { services, createMonitor, createSubscriptionCheckout, appendAddMonitorEvent } = createServices(null);

    const handled = await handleAddMonitorCallback(ctx, services);

    expect(handled).toBe(true);
    expect(answerCbQuery).toHaveBeenCalled();
    expect(appendAddMonitorEvent).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.subscriptionSelected,
      {
        termKey: "sub-30d",
      },
    );
    expect(createMonitor).not.toHaveBeenCalled();
    expect(createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        chatId: "123",
        funnelSessionId: "funnel_1",
      }),
    );
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("нужна активная подписка Telegram Stars");
    expect(ctx.session.flow).toBeUndefined();
  });

  it("creates a paid monitor immediately when an active subscription already exists", async () => {
    const { ctx, reply } = createCallbackContext("add-duration:sub-30d");
    const { services, createMonitor, createSubscriptionCheckout, getActiveSubscriptionForUser, completeAddMonitorSession } =
      createServices(null);
    getActiveSubscriptionForUser.mockResolvedValue({
      currentPeriodEnd: new Date("2026-05-10T12:00:00.000Z"),
    });

    const handled = await handleAddMonitorCallback(ctx, services);

    expect(handled).toBe(true);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        termKind: "SUBSCRIPTION",
      }),
    );
    expect(completeAddMonitorSession).toHaveBeenCalledWith(
      "funnel_1",
      "user_1",
      ADD_MONITOR_FUNNEL_STEPS.monitorCreated,
      expect.objectContaining({
        monitorId: "monitor_1",
        termKey: "sub-30d",
        termKind: "subscription",
      }),
    );
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("Монитор сохранен");
  });
});
