import { logger } from "./logger";

export interface ShutdownHandler {
  name: string;
  close: () => Promise<void>;
}

export function registerGracefulShutdown(handlers: ShutdownHandler[]): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");

    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler.close();
          logger.info({ handler: handler.name }, "Shutdown handler completed");
        } catch (error) {
          logger.error({ err: error, handler: handler.name }, "Shutdown handler failed");
        }
      }),
    );

    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
