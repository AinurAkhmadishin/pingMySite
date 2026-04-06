import { createAppServices } from "../app/services";
import { startBot } from "../bot/app";
import { registerGracefulShutdown } from "../lib/graceful-shutdown";

async function main(): Promise<void> {
  const services = createAppServices();
  await services.prisma.$connect();
  const bot = await startBot(services);

  registerGracefulShutdown([
    {
      name: "telegram-bot",
      close: bot.close,
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
