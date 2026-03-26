import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiSuccess({ count: 0 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    const count = await prisma.messages.count({
      where: {
        recipientId: userId,
        readAt: null,
      },
    });

    return apiSuccess({ count });
  } catch (error) {
    return apiSuccess({ count: 0 });
  }
}
