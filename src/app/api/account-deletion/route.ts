import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    await prisma.$transaction(async (tx) => {
      const hash = `deleted_${session.user.id.substring(0, 8)}`;

      // Anonymize user data
      await tx.users.update({
        where: { id: session.user.id },
        data: {
          email: `${hash}@deleted.directfanz.com`,
          displayName: 'Deleted User',
          password: null,
          bio: null,
          avatar: null,
          socialLinks: Prisma.JsonNull,
          notificationPreferences: Prisma.JsonNull,
        },
      });

      // Cancel active subscriptions
      await tx.subscriptions.updateMany({
        where: { fanId: session.user.id, status: 'ACTIVE' },
        data: { status: 'CANCELED' },
      });
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('INTERNAL_ERROR', 'Deletion failed');
  }
}
