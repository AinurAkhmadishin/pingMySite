import { PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { logger } from "../lib/logger";

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient__: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  prisma.$on("error", (event) => {
    logger.error({ target: event.target, message: event.message }, "Prisma error");
  });

  return prisma;
}

export const prisma = globalThis.__prismaClient__ ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.__prismaClient__ = prisma;
}
