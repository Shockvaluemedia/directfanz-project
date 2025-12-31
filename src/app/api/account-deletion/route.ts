import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-production';
import { getDatabaseClient } from '@/lib/database-production';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDatabaseClient();
  
  try {
    await db.transaction(async (prisma) => {
      // Anonymize user data
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          email: `deleted-${Date.now()}@deleted.local`,
          name: 'Deleted User',
          password: null,
          isActive: false,
        },
      });

      // Delete personal data but preserve anonymized analytics
      await prisma.userProfile.deleteMany({
        where: { userId: session.user.id },
      });

      // Log deletion
      await prisma.auditLog.create({
        data: {
          event: 'account_deletion',
          userId: session.user.id,
          timestamp: new Date(),
          data: JSON.stringify({ deletedAt: new Date() }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}