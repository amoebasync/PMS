// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();
  // ↑ v5では引数なしでOK (schema.prismaのenv()を読みに行きます)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;