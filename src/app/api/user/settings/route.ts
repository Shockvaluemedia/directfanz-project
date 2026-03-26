import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const settingsUpdateSchema = z.object({
  profile: z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    isPrivate: z.boolean().optional(),
  }).optional(),
  notifications: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    newFollowers: z.boolean().optional(),
    newComments: z.boolean().optional(),
    liveStreams: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'followers', 'private']).optional(),
    showOnlineStatus: z.boolean().optional(),
    allowMessages: z.enum(['everyone', 'followers', 'nobody']).optional(),
    showActivity: z.boolean().optional(),
  }).optional(),
}).strict();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        email: true,
        bio: true,
        avatar: true,
        notificationPreferences: true,
        privacySettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    const notificationPrefs = (user.notificationPreferences as Record<string, boolean> | null) || {};
    const privacyPrefs = (user.privacySettings as Record<string, unknown> | null) || {};

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          name: user.displayName,
          email: user.email,
          bio: user.bio || '',
          avatar: user.avatar,
          isPrivate: privacyPrefs.profileVisibility === 'private',
        },
        notifications: {
          emailNotifications: notificationPrefs.emailNotifications ?? true,
          pushNotifications: notificationPrefs.pushNotifications ?? true,
          marketingEmails: notificationPrefs.marketingEmails ?? false,
          newFollowers: notificationPrefs.newFollowers ?? true,
          newComments: notificationPrefs.newComments ?? true,
          liveStreams: notificationPrefs.liveStreams ?? true,
        },
        privacy: {
          profileVisibility: (privacyPrefs.profileVisibility as string) || 'public',
          showOnlineStatus: privacyPrefs.showOnlineStatus ?? true,
          allowMessages: (privacyPrefs.allowMessages as string) || 'followers',
          showActivity: privacyPrefs.showActivity ?? true,
        },
        security: {
          twoFactorEnabled: false,
          loginNotifications: true,
          sessionTimeout: 30,
        },
        billing: {
          currency: 'USD',
          autoRenew: true,
          paymentMethod: '',
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch settings', {}, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const body = await request.json();
    const validated = settingsUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (validated.profile) {
      if (validated.profile.name) updateData.displayName = validated.profile.name;
      if (validated.profile.bio !== undefined) updateData.bio = validated.profile.bio;
    }

    if (validated.notifications) {
      const existing = await prisma.users.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      });
      const current = (existing?.notificationPreferences as Record<string, unknown> | null) || {};
      updateData.notificationPreferences = { ...current, ...validated.notifications };
    }

    if (validated.privacy) {
      const existing = await prisma.users.findUnique({
        where: { id: userId },
        select: { privacySettings: true },
      });
      const current = (existing?.privacySettings as Record<string, unknown> | null) || {};
      updateData.privacySettings = { ...current, ...validated.privacy };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid request data', details: error.errors } },
        { status: 400 }
      );
    }

    logger.error('Failed to update settings', {}, error as Error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
