import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
});

// GET /api/gdpr/export - Download a full data export for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized. You must be logged in to export your data.');
    }

    const url = new URL(request.url);
    const formatParam = url.searchParams.get('format') || 'json';

    const parsed = exportQuerySchema.safeParse({ format: formatParam });
    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'Validation failed');
    }

    const { format } = parsed.data;

    // Check if user has consent for data processing (legal compliance basis allows export)
    const processingCheck = await GDPRComplianceService.processPersonalData(
      session.user.id,
      'LEGAL_COMPLIANCE',
      ['personal_info', 'account_info', 'subscriptions', 'content', 'payments', 'interactions']
    );

    if (!processingCheck.allowed) {
      return apiError('FORBIDDEN', processingCheck.reason || 'Data processing not allowed');
    }

    const userData = await GDPRComplianceService.exportUserData(session.user.id);

    if (format === 'json') {
      const jsonString = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          userId: session.user.id,
          data: userData,
        },
        null,
        2
      );

      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="directfanz-data-export-${session.user.id}-${Date.now()}.json"`,
        },
      });
    }

    // CSV format: flatten the data into rows
    const csvRows: string[] = [];

    // Personal Info section
    csvRows.push('Section,Field,Value');
    csvRows.push(
      `Personal Info,Name,"${escapeCsv(userData.personalInfo.name)}"`,
      `Personal Info,Email,"${escapeCsv(userData.personalInfo.email)}"`,
      `Personal Info,Date of Birth,"${userData.personalInfo.dateOfBirth || ''}"`,
      `Personal Info,Location,"${escapeCsv(userData.personalInfo.location || '')}"`,
      `Personal Info,Phone,"${escapeCsv(userData.personalInfo.phoneNumber || '')}"`
    );

    // Account Info section
    csvRows.push(
      `Account Info,Username,"${escapeCsv(userData.accountInfo.username)}"`,
      `Account Info,Role,"${escapeCsv(userData.accountInfo.role)}"`,
      `Account Info,Created At,"${userData.accountInfo.createdAt}"`,
      `Account Info,Last Login,"${userData.accountInfo.lastLogin || ''}"`,
      `Account Info,Email Verified,"${userData.accountInfo.emailVerified}"`
    );

    // Subscriptions section
    if (userData.subscriptions && userData.subscriptions.length > 0) {
      csvRows.push('');
      csvRows.push('Subscription Artist ID,Tier Name,Start Date,End Date,Amount');
      for (const sub of userData.subscriptions) {
        csvRows.push(
          `"${escapeCsv(sub.artistId)}","${escapeCsv(sub.tierName)}","${sub.startDate}","${sub.endDate || ''}","${sub.amount}"`
        );
      }
    }

    // Content section
    if (userData.content && userData.content.length > 0) {
      csvRows.push('');
      csvRows.push('Content ID,Title,Type,Created At,View Count');
      for (const item of userData.content) {
        csvRows.push(
          `"${escapeCsv(item.id)}","${escapeCsv(item.title)}","${escapeCsv(item.type)}","${item.createdAt}","${item.viewCount || 0}"`
        );
      }
    }

    // Payments section
    if (userData.payments && userData.payments.length > 0) {
      csvRows.push('');
      csvRows.push('Payment ID,Amount,Date,Description,Status');
      for (const payment of userData.payments) {
        csvRows.push(
          `"${escapeCsv(payment.id)}","${payment.amount}","${payment.date}","${escapeCsv(payment.description)}","${escapeCsv(payment.status)}"`
        );
      }
    }

    // Interactions section
    if (userData.interactions && userData.interactions.length > 0) {
      csvRows.push('');
      csvRows.push('Interaction Type,Target ID,Date');
      for (const interaction of userData.interactions) {
        csvRows.push(
          `"${escapeCsv(interaction.type)}","${escapeCsv(interaction.targetId)}","${interaction.date}"`
        );
      }
    }

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="directfanz-data-export-${session.user.id}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GDPR data export error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'An internal error occurred while exporting your data');
  }
}

function escapeCsv(value: string): string {
  return value.replace(/"/g, '""');
}
