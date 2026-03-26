import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { updateCommentSchema } from '@/lib/validations';
import { checkPermission } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// GET /api/fan/comments/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    // Check if user has permission to read comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:read');
    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Forbidden');
    }

    const comment = await prisma.comments.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (!comment) {
      return apiError('NOT_FOUND', 'Comment not found');
    }

    return apiSuccess({ comment });
  } catch (error) {
    logger.error('Error fetching comment', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch comment');
  }
}

// PUT /api/fan/comments/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    // Get the comment to check ownership
    const comment = await prisma.comments.findUnique({
      where: { id: params.id },
    });

    if (!comment) {
      return apiError('NOT_FOUND', 'Comment not found');
    }

    // Check if user is the comment owner
    if (comment.fanId !== session.user.id) {
      // Check if user has permission to update any comments (admin)
      const hasPermission = await checkPermission(session.user.id, 'fan:comments:update');
      if (!hasPermission) {
        return apiError('FORBIDDEN', 'Forbidden');
      }
    }

    const body = await request.json();

    // Validate request body
    const validatedData = updateCommentSchema.parse(body);

    // Update comment
    const updatedComment = await prisma.comments.update({
      where: { id: params.id },
      data: {
        text: validatedData.text,
      },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    return apiSuccess({ comment: updatedComment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('BAD_REQUEST', error.errors);
    }

    logger.error('Error updating comment', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to update comment');
  }
}

// DELETE /api/fan/comments/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession();

  if (!session?.user) {
    return apiError('UNAUTHORIZED', 'Unauthorized');
  }

  try {
    // Get the comment to check ownership
    const comment = await prisma.comments.findUnique({
      where: { id: params.id },
    });

    if (!comment) {
      return apiError('NOT_FOUND', 'Comment not found');
    }

    // Check if user is the comment owner
    if (comment.fanId !== session.user.id) {
      // Check if user has permission to delete any comments (admin)
      const hasPermission = await checkPermission(session.user.id, 'fan:comments:delete');
      if (!hasPermission) {
        return apiError('FORBIDDEN', 'Forbidden');
      }
    }

    // Delete comment
    await prisma.comments.delete({
      where: { id: params.id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error('Error deleting comment', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Failed to delete comment');
  }
}
