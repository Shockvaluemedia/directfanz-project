import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { createComment, getCommentsByContentId } from '@/lib/database';
import { createCommentSchema } from '@/lib/validations';
import { checkPermission } from '@/lib/rbac';
import { notifyContentComment } from '@/lib/notifications';

// GET /api/fan/comments?contentId=xxx
export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get contentId from query params
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get('contentId');

  if (!contentId) {
    return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
  }

  try {
    // Check if user has permission to read comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:read');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comments = await getCommentsByContentId(contentId);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/fan/comments
export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user has permission to create comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:create');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
