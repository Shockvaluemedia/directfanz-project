import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  NotificationPreferences,
} from '@/lib/notifications';
import { apiSuccess, apiError, apiValidationError } from '@/lib/api-response';

// Validation schema for notification preferences
const notificationPreferencesSchema = z.object({
  newContent: z.boolean().optional(),
  comments: z.boolean().optional(),
  subscriptionUpdates: z.boolean().optional(),
});

// GET /api/user/notifications/preferences
export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    const preferences = await getUserNotificationPreferences(session.user.id);
    return apiSuccess({ preferences });
  } catch (error) {
    logger.error('Error fetching notification preferences', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch notification preferences');
  }
}

// PUT /api/user/notifications/preferences
export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    const body = await request.json();

    // Validate request body
    const validatedData = notificationPreferencesSchema.parse(body);

    // Update preferences
    const updatedPreferences = await updateUserNotificationPreferences(
      session.user.id,
      validatedData as Partial<NotificationPreferences>
    );

    return apiSuccess({ preferences: updatedPreferences });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiValidationError(error.errors);
    }

    logger.error('Error updating notification preferences', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to update notification preferences');
  }
}
