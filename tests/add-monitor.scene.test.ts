import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppServices } from "../src/app/services";
import { DEFAULT_FAILURE_THRESHOLD } from "../src/config/constants";
import { BotContext } from "../src/types/bot";

vi.mock("../src/config/env", () => ({
  env: {
    DEFAULT_TIMEOUT_MS: 5000,
  },
}));

let handleAddMonitorText: typeof import("../src/bot/scenes/add-monitor.scene").handleAddMonitorText;
let handleAddMonitorCallback: typeof import("../src/bot/scenes/add-monitor.scene").handleAddMonitorCallback;

beforeAll(async () => {
  ({ handleAddMonitorText, handleAddMonitorCallback } = await import("../src/bot/scenes/add-monitor.scene"));
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
} {
  const findExistingMonitorByUrl = vi.fn().mockResolvedValue(existingMonitor);
  const createMonitor = vi.fn();

  return {
    services: {
      monitorService: {
        findExistingMonitorByUrl,
        createMonitor,
      },
    } as unknown as AppServices,
    findExistingMonitorByUrl,
    createMonitor,
  };
}

function createCallbackContext(data: string): { ctx: BotContext; answerCbQuery: ReturnType<typeof vi.fn> } {
  const answerCbQuery = vi.fn().mockResolvedValue(undefined);

  return {
    ctx: {
      callbackQuery: { data },
      answerCbQuery,
      reply: vi.fn().mockResolvedValue(undefined),
      session: {
        flow: {
          kind: "add",
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
          timezone: "Europe/Moscow",
        },
      },
    } as unknown as BotContext,
    answerCbQuery,
  };
}

describe("add monitor scene", () => {
  it("stops the flow immediately when the url already exists for the current user", async () => {
    const { ctx, reply } = createContext("example.com");
    const { services, findExistingMonitorByUrl } = createServices({ id: "monitor_1" });

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).toHaveBeenCalledWith("user_1", "https://example.com/");
    expect(ctx.session.flow).toBeUndefined();
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("Опрос остановлен");
  });

  it("stops the flow and warns when the site address is invalid", async () => {
    const { ctx, reply } = createContext("example");
    const { services, findExistingMonitorByUrl } = createServices(null);

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).not.toHaveBeenCalled();
    expect(ctx.session.flow).toBeUndefined();
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toContain("Опрос остановлен");
  });

  it("moves to the name step when the url is unique", async () => {
    const { ctx, reply } = createContext("example.com");
    const { services, findExistingMonitorByUrl } = createServices(null);

    const handled = await handleAddMonitorText(ctx, services);

    expect(handled).toBe(true);
    expect(findExistingMonitorByUrl).toHaveBeenCalledWith("user_1", "https://example.com/");
    expect(ctx.session.flow).toMatchObject({
      kind: "add",
      step: "name",
    });
    expect((ctx.session.flow as Extract<BotContext["session"]["flow"], { kind: "add" }>).draft.url).toBe(
      "https://example.com/",
    );
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("does not allow selecting a paid term while payments are disabled", async () => {
    const { ctx, answerCbQuery } = createCallbackContext("add-duration-disabled:sub-1m");
    const { services, createMonitor } = createServices(null);

    const handled = await handleAddMonitorCallback(ctx, services);

    expect(handled).toBe(true);
    expect(createMonitor).not.toHaveBeenCalled();
    expect(answerCbQuery).toHaveBeenCalledWith("Оплата подписки пока не подключена.");
    expect(ctx.session.flow).toMatchObject({
      kind: "add",
      step: "duration",
    });
  });
});
