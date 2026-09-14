import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Single shared PrismaClient instance.
 *
 * In development Next.js hot-reloads modules, which would otherwise create a
 * new client (and a new connection pool) on every reload. We cache it on the
 * global object to avoid exhausting database connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
