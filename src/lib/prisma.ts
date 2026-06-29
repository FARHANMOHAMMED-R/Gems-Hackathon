import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance. In dev with hot-reload we cache it on the
// global object to avoid exhausting the connection pool on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
