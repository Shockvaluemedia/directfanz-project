import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { withErrorHandling } from '@/lib/error-handler';
import { createAuthError } from '@/lib/errors';
import { initiateUserDataDeletion } from '@/lib/security';
import { logger } from '@/lib/logger';

export const POST = withErrorHandling(async (context) => {
  // Get the authenticated user
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    throw createAuthError('Authentication required', undefined, context.requestId);
  }
  
  const userId = session.user.id;
  
  // Log the data deletion request
  logger.securityEvent(`GDPR data deletion requested for user ${userId}`, 'medium', {
    userId,
    requestId: context.requestId,
  });
  
  // Initiate the data deletion process
  await initiateUserDataDeletion(userId);
  
  // Return success response
  return {
    success: true,
    message: 'Data deletion request received and being processed',
  };
});