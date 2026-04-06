import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const telegramId = process.env.SEED_TELEGRAM_ID;

  if (!telegramId) {
    console.log("SEED_TELEGRAM_ID не задан. База инициализирована без демо-данных.");
    return;
  }

  const user = await prisma.user.upsert({
    where: {
      telegramId,
    },
    update: {},
    create: {
      telegramId,
      firstName: "Demo",
      username: "demo_user",
      dailySummaryEnabled: false,
      weeklySummaryEnabled: false,
    },
  });

  await prisma.monitor.upsert({
    where: {
      id: "seed-monitor-example",
    },
    update: {},
    create: {
      id: "seed-monitor-example",
      userId: user.id,
      name: "Example",
      url: "https://example.com/",
      normalizedUrl: "https://example.com/",
      intervalMinutes: 5,
      timeoutMs: 5000,
      currentState: "UNKNOWN",
      checkSsl: true,
      isActive: true,
    },
  });

  console.log("Добавлены демо-пользователь и монитор.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
