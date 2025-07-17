import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { withErrorHandling } from '@/lib/error-handler';
import { createAuthError } from '@/lib/errors';
import { generateUserDataExport } from '@/lib/security';
import { logger } from '@/lib/logger';

export const POST = withErrorHandling(async (context) => {
  // Get the authenticated user
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    throw createAuthError('Authentication required', undefined, context.requestId);
  }
  
  const userId = session.user.id;
  
  // Log the data export request
  logger.info(`GDPR data export requested for user ${userId}`, {
    userId,
    requestId: context.requestId,
  });
  
  // Generate the user data export
  const userData = await generateUserDataExport(userId);
  
  // Return the data as a downloadable JSON file
  return new Response(JSON.stringify(userData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="data-export-${userId}.json"`,
    },
  });
});