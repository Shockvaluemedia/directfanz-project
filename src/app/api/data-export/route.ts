import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-production';
import { getDatabaseClient } from '@/lib/database-production';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { format = 'json' } = await request.json();
  const db = getDatabaseClient();

  const exportRequest = await db.client.dataExportRequest.create({
    data: {
      userId: session.user.id,
      format,
      status: 'pending',
      requestedAt: new Date(),
    },
  });

  processDataExport(session.user.id, exportRequest.id, format);

  return NextResponse.json({
    requestId: exportRequest.id,
    status: 'pending',
  });
}

async function processDataExport(userId: string, requestId: string, format: string) {
  const db = getDatabaseClient();
  
  try {
    await db.client.dataExportRequest.update({
      where: { id: requestId },
      data: { status: 'processing' },
    });

    const userData = await collectUserData(userId);
    const exportData = format === 'json' ? JSON.stringify(userData, null, 2) : convertToCSV(userData);
    
    await db.client.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        downloadUrl: `/api/data-export/download/${requestId}`,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await db.client.dataExportRequest.update({
      where: { id: requestId },
      data: { status: 'failed' },
    });
  }
}

async function collectUserData(userId: string) {
  const db = getDatabaseClient();
  
  const user = await db.client.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      subscriptions: true,
      content: true,
      comments: true,
    },
  });

  return { user, exportedAt: new Date().toISOString() };
}

function convertToCSV(data: any): string {
  return JSON.stringify(data);
}