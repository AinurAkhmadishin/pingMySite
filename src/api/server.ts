import { createServer } from "node:http";

import express from "express";

import { AppServices } from "../app/services";
import { env } from "../config/env";
import { toErrorMessage } from "../lib/http";
import { logger } from "../lib/logger";
import { createDashboardRouter } from "./dashboard.routes";

export async function startApiServer(services: AppServices): Promise<{ close: () => Promise<void> }> {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", env.DASHBOARD_CORS_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json());
  app.use("/api/dashboard", createDashboardRouter(services));

  app.get("/", (_req, res) => {
    res.json({
      service: "Ping My Site Bot",
      status: "ok",
    });
  });

  app.get("/health", async (_req, res) => {
    try {
      const [monitorCount, worker, stuckUnknown] = await Promise.all([
        services.prisma.monitor.count({
          where: {
            deletedAt: null,
          },
        }),
        services.workerHealthService.getWorkerStatus(),
        services.monitorHealthService.getStuckUnknownSummary(),
      ]);

      const ok = worker.isAlive && stuckUnknown.count === 0;

      res.status(ok ? 200 : 503).json({
        ok,
        monitorCount,
        uptimeSeconds: Math.round(process.uptime()),
        worker,
        stuckUnknown,
      });
    } catch (error) {
      logger.error({ err: error }, "Health check failed");

      res.status(503).json({
        ok: false,
        error: toErrorMessage(error),
        uptimeSeconds: Math.round(process.uptime()),
      });
    }
  });

  const server = createServer(app);
  let adminAlertTimer: NodeJS.Timeout | undefined;

  await new Promise<void>((resolve) => {
    server.listen(env.APP_PORT, env.APP_HOST, () => {
      logger.info({ host: env.APP_HOST, port: env.APP_PORT }, "API server started");
      resolve();
    });
  });

  if (env.ENABLE_ADMIN_ALERTS && env.ADMIN_TELEGRAM_CHAT_ID) {
    const runAdminHealthCheck = async () => {
      try {
        await services.adminAlertService.inspectAndNotify();
      } catch (error) {
        logger.error({ err: error }, "Failed to inspect admin health alerts");
      }
    };

    void runAdminHealthCheck();
    adminAlertTimer = setInterval(() => {
      void runAdminHealthCheck();
    }, env.ADMIN_ALERT_SCAN_INTERVAL_SECONDS * 1000);
    adminAlertTimer.unref?.();
  }

  return {
    close: async () => {
      if (adminAlertTimer) {
        clearInterval(adminAlertTimer);
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
