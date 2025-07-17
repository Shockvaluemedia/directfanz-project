import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { updateCommentSchema } from '@/lib/validations';
import { checkPermission } from '@/lib/rbac';

// GET /api/fan/comments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Check if user has permission to read comments
    const hasPermission = await checkPermission(session.user.id, 'fan:comments:read');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      include: {
        fan: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });
    
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    
    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Error fetching comment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comment' },
      { status: 500 }
    );
  }
}

// PUT /api/fan/comments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get the comment to check ownership
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });
    
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    
    // Check if user is the comment owner
    if (comment.fanId !== session.user.id) {
      // Check if user has permission to update any comments (admin)
      const hasPermission = await checkPermission(session.user.id, 'fan:comments:update');
      if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    const body = await request.json();
    
    // Validate request body
    const validatedData = updateCommentSchema.parse(body);
    
    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id: params.id },
      data: {
        text: validatedData.text,
      },
      include: {
        fan: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });
    
    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// DELETE /api/fan/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get the comment to check ownership
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });
    
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    
    // Check if user is the comment owner
    if (comment.fanId !== session.user.id) {
      // Check if user has permission to delete any comments (admin)
      const hasPermission = await checkPermission(session.user.id, 'fan:comments:delete');
      if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    // Delete comment
    await prisma.comment.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}