import { createAppServices } from "./app/services";
import { startApiServer } from "./api/server";
import { startBot } from "./bot/app";
import { startWorkers } from "./jobs/workers";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";

async function main(): Promise<void> {
  const services = createAppServices();
  await services.prisma.$connect();

  const [apiServer, bot, workers] = await Promise.all([
    startApiServer(services),
    startBot(services),
    startWorkers(services),
  ]);

  registerGracefulShutdown([
    {
      name: "api-server",
      close: apiServer.close,
    },
    {
      name: "telegram-bot",
      close: bot.close,
    },
    {
      name: "workers",
      close: workers.close,
    },
    {
      name: "queues",
      close: () => services.queueManager.close(),
    },
    {
      name: "redis",
      close: async () => {
        await services.redis.quit();
      },
    },
    {
      name: "prisma",
      close: () => services.prisma.$disconnect(),
    },
  ]);
}

void main();
