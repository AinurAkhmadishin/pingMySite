import { createAppServices } from "../app/services";
import { registerGracefulShutdown } from "../lib/graceful-shutdown";
import { startWorkers } from "../jobs/workers";

async function main(): Promise<void> {
  const services = createAppServices();
  await services.prisma.$connect();
  const workers = await startWorkers(services);

  registerGracefulShutdown([
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
