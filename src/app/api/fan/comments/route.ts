import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { createComment, getCommentsByContentId } from '@/lib/database';
import { createCommentSchema } from '@/lib/validations';
import { checkPermission } from '@/lib/rbac';
import { notifyContentComment } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { apiSuccess, apiCreated, apiError, apiValidationError } from '@/lib/api-response';

// GET /api/fan/comments?contentId=xxx
export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  // Get contentId from query params
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get('contentId');

  if (!contentId) {
    return apiError('BAD_REQUEST', 'Content ID is required');
  }

  try {
    // Check if user has permission to read comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:read');
    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Forbidden');
    }

    const comments = await getCommentsByContentId(contentId);
    return apiSuccess({ comments });
  } catch (error) {
    logger.error('Error fetching comments', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch comments');
  }
}

// POST /api/fan/comments
export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    // Check if user has permission to create comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:create');
    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Forbidden');
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createCommentSchema.parse(body);

    // Create comment
    const comment = await createComment({
      contentId: validatedData.contentId,
      fanId: session.user.id,
      text: validatedData.text,
    });

    // Send notification to content owner
    await notifyContentComment(
      validatedData.contentId,
      validatedData.text,
      session.user.name || 'A fan'
    );

    return apiCreated({ comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiValidationError(error.errors);
    }

    logger.error('Error creating comment', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to create comment');
  }
}
