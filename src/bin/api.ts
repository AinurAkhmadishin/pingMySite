import { createAppServices } from "../app/services";
import { startApiServer } from "../api/server";
import { registerGracefulShutdown } from "../lib/graceful-shutdown";

async function main(): Promise<void> {
  const services = createAppServices();
  await services.prisma.$connect();
  const apiServer = await startApiServer(services);

  registerGracefulShutdown([
    {
      name: "api-server",
      close: apiServer.close,
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
