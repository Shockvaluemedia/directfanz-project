import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { FileUploader } from '@/lib/upload';

const listQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  type: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).optional(),
  tierId: z.string().cuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'title', 'fileSize', 'duration']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).optional(),
  tierIds: z.array(z.string().cuid()).optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/content - List content for artist or browse public content
export async function GET(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = listQuerySchema.parse({
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '20',
        type: searchParams.get('type') || undefined,
        visibility: searchParams.get('visibility') || undefined,
        tierId: searchParams.get('tierId') || undefined,
        search: searchParams.get('search') || undefined,
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
      });

      const page = parseInt(query.page);
      const limit = Math.min(parseInt(query.limit), 100); // Max 100 items per page
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      // If user is artist, show their content
      // If user is fan, show content they have access to
      if (req.user.role === 'ARTIST') {
        where.artistId = req.user.id;
      } else {
        // For fans, show public content or content from subscribed tiers
        const subscriptions = await prisma.subscription.findMany({
          where: {
            fanId: req.user.id,
            status: 'ACTIVE',
          },
          select: {
            tierId: true,
          },
        });

        const subscribedTierIds = subscriptions.map(sub => sub.tierId);

        where.OR = [
          { visibility: 'PUBLIC' },
          {
            tiers: {
              some: {
                id: { in: subscribedTierIds },
              },
            },
          },
        ];
      }

      // Add filters
      if (query.type) {
        where.type = query.type;
      }

      if (query.visibility !== undefined) {
        where.visibility = query.visibility;
      }

      if (query.tierId) {
        where.tiers = {
          some: { id: query.tierId },
        };
      }

      if (query.search) {
        where.OR = where.OR ? [...where.OR, 
          { title: { contains: query.search } },
          { description: { contains: query.search } },
        ] : [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
        ];
      }

      // Build order by
      const orderBy: any = {};
      orderBy[query.sortBy] = query.sortOrder;

      // Fetch content
      const [content, totalCount] = await Promise.all([
        prisma.content.findMany({
          where,
          include: {
            artist: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            tiers: {
              select: {
                id: true,
                name: true,
                minimumPrice: true,
              },
            },
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.content.count({ where }),
      ]);

      // Parse tags and format response
      const formattedContent = content.map(item => ({
        ...item,
        tags: JSON.parse(item.tags),
        commentCount: item._count.comments,
        _count: undefined,
      }));

      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return NextResponse.json({
        success: true,
        data: {
          content: formattedContent,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNextPage,
            hasPreviousPage,
          },
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Content list error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: 500 }
      );
    }
  });
}

// POST /api/content - Create new content (metadata only, file uploaded separately)
export async function POST(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json(
          { error: 'Only artists can create content' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const validatedData = updateSchema.parse(body);

      // Validate tier ownership if specified
      if (validatedData.tierIds && validatedData.tierIds.length > 0) {
        const userTiers = await prisma.tier.findMany({
          where: {
            id: { in: validatedData.tierIds },
            artistId: req.user.id,
            isActive: true,
          },
          select: { id: true },
        });

        if (userTiers.length !== validatedData.tierIds.length) {
          return NextResponse.json(
            { error: 'One or more specified tiers do not exist or are not owned by you' },
            { status: 400 }
          );
        }
      }

      // This endpoint is for metadata-only creation
      // Files should be uploaded via /api/content/upload
      return NextResponse.json(
        { error: 'Use /api/content/upload for file uploads' },
        { status: 400 }
      );

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid content data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Content creation error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to create content' },
        { status: 500 }
      );
    }
  });
}

// PUT /api/content - Update content metadata
export async function PUT(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json(
          { error: 'Only artists can update content' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const contentId = searchParams.get('id');

      if (!contentId) {
        return NextResponse.json(
          { error: 'Content ID is required' },
          { status: 400 }
        );
      }

      // Verify content ownership
      const existingContent = await prisma.content.findFirst({
        where: {
          id: contentId,
          artistId: req.user.id,
        },
        include: {
          tiers: {
            select: { id: true },
          },
        },
      });

      if (!existingContent) {
        return NextResponse.json(
          { error: 'Content not found or access denied' },
          { status: 404 }
        );
      }

      const body = await request.json();
      const validatedData = updateSchema.parse(body);

      // Validate tier ownership if specified
      if (validatedData.tierIds && validatedData.tierIds.length > 0) {
        const userTiers = await prisma.tier.findMany({
          where: {
            id: { in: validatedData.tierIds },
            artistId: req.user.id,
            isActive: true,
          },
          select: { id: true },
        });

        if (userTiers.length !== validatedData.tierIds.length) {
          return NextResponse.json(
            { error: 'One or more specified tiers do not exist or are not owned by you' },
            { status: 400 }
          );
        }
      }

      // Update content
      const updateData: any = {};
      if (validatedData.title !== undefined) updateData.title = validatedData.title;
      if (validatedData.description !== undefined) updateData.description = validatedData.description;
      if (validatedData.visibility !== undefined) updateData.visibility = validatedData.visibility;
      if (validatedData.tags !== undefined) updateData.tags = JSON.stringify(validatedData.tags);

      const updatedContent = await prisma.content.update({
        where: { id: contentId },
        data: {
          ...updateData,
          ...(validatedData.tierIds && {
            tiers: {
              set: validatedData.tierIds.map(id => ({ id })),
            },
          }),
        },
        include: {
          artist: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          tiers: {
            select: {
              id: true,
              name: true,
              minimumPrice: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
      });

      // Format response
      const formattedContent = {
        ...updatedContent,
        tags: JSON.parse(updatedContent.tags),
        commentCount: updatedContent._count.comments,
        _count: undefined,
      };

      logger.info('Content updated', { 
        userId: req.user.id, 
        contentId: contentId,
        changes: Object.keys(updateData)
      });

      return NextResponse.json({
        success: true,
        data: formattedContent,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid update data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Content update error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to update content' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/content - Delete content
export async function DELETE(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json(
          { error: 'Only artists can delete content' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const contentId = searchParams.get('id');

      if (!contentId) {
        return NextResponse.json(
          { error: 'Content ID is required' },
          { status: 400 }
        );
      }

      // Verify content ownership and get file info
      const existingContent = await prisma.content.findFirst({
        where: {
          id: contentId,
          artistId: req.user.id,
        },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          thumbnailUrl: true,
        },
      });

      if (!existingContent) {
        return NextResponse.json(
          { error: 'Content not found or access denied' },
          { status: 404 }
        );
      }

      // Delete the content record (this will also cascade delete related records)
      await prisma.content.delete({
        where: { id: contentId },
      });

      // TODO: Delete actual files from storage
      // This should be implemented based on your file storage solution
      // For now, we'll just log what files should be deleted
      if (existingContent.fileUrl) {
        logger.info('File deletion needed', {
          contentId,
          fileUrl: existingContent.fileUrl,
          thumbnailUrl: existingContent.thumbnailUrl,
        });
      }

      logger.info('Content deleted', { 
        userId: req.user.id, 
        contentId: contentId,
        title: existingContent.title
      });

      return NextResponse.json({
        success: true,
        message: 'Content deleted successfully',
      });

    } catch (error) {
      logger.error('Content deletion error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to delete content' },
        { status: 500 }
      );
    }
  });
}
