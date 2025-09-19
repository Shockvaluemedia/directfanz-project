import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, APIErrors, withErrorHandling } from '@/lib/api-errors';

export const GET = withErrorHandling(async () => {
  // Simple test query
  const userCount = await prisma.users.count();

  return createSuccessResponse({
    message: 'Database connection working',
    userCount,
    prismaInstance: typeof prisma,
    hasFindUnique: typeof prisma.users.findUnique,
  });
});
