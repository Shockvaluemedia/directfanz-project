import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { 
  getUserNotificationPreferences, 
  updateUserNotificationPreferences,
  NotificationPreferences
} from '@/lib/notifications';

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const preferences = await getUserNotificationPreferences(session.user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

// PUT /api/user/notifications/preferences
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    
    return NextResponse.json({ preferences: updatedPreferences });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}