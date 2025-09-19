import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Database health check
export async function checkDatabaseConnection() {
  try {
    await db.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  await db.$disconnect();
}

// Database utilities for common operations
export const dbUtils = {
  // Transaction wrapper
  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return await db.$transaction(fn);
  },

  // Soft delete helper (if implementing soft deletes)
  async softDelete(model: any, id: string) {
    return await model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  // Pagination helper
  getPaginationParams(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    return {
      skip,
      take: limit,
    };
  },

  // Search helper
  createSearchFilter(searchTerm: string, fields: string[]) {
    if (!searchTerm) return {};

    return {
      OR: fields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    };
  },
};

export default db;
