import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserAccessibleContent, getContentAccessSummary } from '@/lib/content-access';
import { UserRole } from '@/types/database';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// Get accessible content for a specific artist
export async function GET(request: NextRequest, { params }: { params: { artistId: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || undefined;
    const summary = searchParams.get('summary') === 'true';

    // If summary is requested, return access summary
    if (summary) {
      const accessSummary = await getContentAccessSummary(session.user.id, params.artistId);

      return apiSuccess(accessSummary);
    }

    // Get accessible content
    const result = await getUserAccessibleContent(session.user.id, params.artistId, {
      page,
      limit,
      type,
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error('Fan content access error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch accessible content');
  }
}
