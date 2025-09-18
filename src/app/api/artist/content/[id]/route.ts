import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma'
import { deleteFile, extractKeyFromUrl } from '@/lib/s3';
import { z } from 'zod';

const updateContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tierIds: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  thumbnailUrl: z.string().url().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    const content = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
      include: {
        tiers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!content) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: content,
    });

  } catch (error) {
    console.error('Content fetch error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updateContentSchema.parse(body);

    // Check if content exists and belongs to artist
    const existingContent = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
    });

    if (!existingContent) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content not found' } },
        { status: 404 }
      );
    }

    // Verify that specified tiers belong to the artist
    if (validatedData.tierIds && validatedData.tierIds.length > 0) {
      const tierCount = await prisma.tier.count({
        where: {
          id: { in: validatedData.tierIds },
          artistId: session.user.id,
        },
      });

      if (tierCount !== validatedData.tierIds.length) {
        return NextResponse.json(
          { error: { code: 'INVALID_TIERS', message: 'One or more tiers do not belong to this artist' } },
          { status: 400 }
        );
      }
    }

    // Update content
    const updateData: any = {};
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.thumbnailUrl !== undefined) updateData.thumbnailUrl = validatedData.thumbnailUrl;

    // Handle tier updates
    if (validatedData.tierIds !== undefined) {
      updateData.tiers = {
        set: validatedData.tierIds.map(id => ({ id })),
      };
    }

    const updatedContent = await prisma.content.update({
      where: { id: params.id },
      data: updateData,
      include: {
        tiers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedContent,
    });

  } catch (error) {
    console.error('Content update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Invalid request data',
            details: { errors: error.errors }
          } 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update content' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    // Check if content exists and belongs to artist
    const existingContent = await prisma.content.findFirst({
      where: {
        id: params.id,
        artistId: session.user.id,
      },
    });

    if (!existingContent) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content not found' } },
        { status: 404 }
      );
    }

    // Delete file from S3
    try {
      const fileKey = extractKeyFromUrl(existingContent.fileUrl);
      await deleteFile(fileKey);
      
      // Delete thumbnail if exists
      if (existingContent.thumbnailUrl) {
        const thumbnailKey = extractKeyFromUrl(existingContent.thumbnailUrl);
        await deleteFile(thumbnailKey);
      }
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete content from database
    await prisma.content.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Content deleted successfully',
    });

  } catch (error) {
    console.error('Content deletion error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete content' } },
      { status: 500 }
    );
  }
}