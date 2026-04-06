import { createServer } from "node:http";

import express from "express";

import { AppServices } from "../app/services";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export async function startApiServer(services: AppServices): Promise<{ close: () => Promise<void> }> {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      service: "Ping My Site Bot",
      status: "ok",
    });
  });

  app.get("/health", async (_req, res) => {
    const monitorCount = await services.prisma.monitor.count({
      where: {
        deletedAt: null,
      },
    });

    res.json({
      ok: true,
      monitorCount,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(env.APP_PORT, env.APP_HOST, () => {
      logger.info({ host: env.APP_HOST, port: env.APP_PORT }, "API server started");
      resolve();
    });
  });

  return {
    close: async () => {
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
