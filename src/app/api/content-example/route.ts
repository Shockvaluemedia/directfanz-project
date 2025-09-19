/**
 * Example: Migrated API route using unified error handling
 * This shows how to convert an existing route to use the new error system
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  withAuthenticatedApiHandler,
  validateApiRequest,
  createSuccessResponse,
  ApiRequestContext,
} from '@/lib/api-error-handler';
import { AppError, ErrorCode } from '@/lib/errors';

// Input validation schema
const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']),
  tierIds: z.array(z.string().cuid()).optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
});

const listQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(n => n > 0, 'Page must be positive')
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .default('20'),
  type: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).optional(),
  search: z.string().min(1).optional(),
});

// GET /api/content-example - List content with unified error handling
export const GET = withAuthenticatedApiHandler(
  async (context: ApiRequestContext, userId: string, userRole: string, request: NextRequest) => {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const query = validateApiRequest(
      listQuerySchema,
      {
        page: searchParams.get('page') || '1',
        limit: searchParams.get('limit') || '20',
        type: searchParams.get('type') || undefined,
        visibility: searchParams.get('visibility') || undefined,
        search: searchParams.get('search') || undefined,
      },
      context
    );

    const skip = (query.page - 1) * query.limit;

    // Build where clause based on user role
    const where: any = {};

    if (userRole === 'ARTIST') {
      where.artistId = userId;
    } else if (userRole === 'FAN') {
      // For fans, get subscribed tiers
      const subscriptions = await prisma.subscriptions.findMany({
        where: {
          fanId: userId,
          status: 'ACTIVE',
        },
        select: { tierId: true },
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
    } else {
      // Admin or other roles see everything
    }

    // Apply filters
    if (query.type) {
      where.type = query.type;
    }

    if (query.visibility) {
      where.visibility = query.visibility;
    }

    if (query.search) {
      where.OR = where.OR
        ? [
            ...where.OR,
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ]
        : [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ];
    }

    // Execute database queries
    const [content, totalCount] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          users: {
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.content.count({ where }),
    ]);

    // Format response data
    const formattedContent = content.map(item => ({
      ...item,
      tags: JSON.parse(item.tags || '[]'),
      commentCount: item._count.comments,
      _count: undefined,
    }));

    const totalPages = Math.ceil(totalCount / query.limit);
    const hasNextPage = query.page < totalPages;
    const hasPreviousPage = query.page > 1;

    // Return success response (automatically wrapped by handler)
    return {
      content: formattedContent,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }
);

// POST /api/content-example - Create content with unified error handling
export const POST = withAuthenticatedApiHandler(
  async (context: ApiRequestContext, userId: string, userRole: string, request: NextRequest) => {
    // Only artists can create content
    if (userRole !== 'ARTIST') {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Only artists can create content',
        403,
        { requiredRole: 'ARTIST', userRole },
        context.requestId,
        userId
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validateApiRequest(createContentSchema, body, context);

    // Validate tier ownership if specified
    if (validatedData.tierIds && validatedData.tierIds.length > 0) {
      const userTiers = await prisma.tiers.findMany({
        where: {
          id: { in: validatedData.tierIds },
          artistId: userId,
          isActive: true,
        },
        select: { id: true },
      });

      if (userTiers.length !== validatedData.tierIds.length) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          'One or more specified tiers do not exist or are not owned by you',
          403,
          {
            requestedTiers: validatedData.tierIds,
            validTiers: userTiers.map(t => t.id),
          },
          context.requestId,
          userId
        );
      }
    }

    // Create content record
    const newContent = await prisma.content.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        visibility: validatedData.visibility,
        tags: JSON.stringify(validatedData.tags || []),
        artistId: userId,
        type: 'DOCUMENT', // Default type - would be determined by file upload
        ...(validatedData.tierIds && {
          tiers: {
            connect: validatedData.tierIds.map(id => ({ id })),
          },
        }),
      },
      include: {
        users: {
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
      ...newContent,
      tags: JSON.parse(newContent.tags || '[]'),
      commentCount: newContent._count.comments,
      _count: undefined,
    };

    // Return created content with 201 status
    return createSuccessResponse(formattedContent, context, 201);
  }
);

// PUT /api/content-example - Update content with unified error handling
export const PUT = withAuthenticatedApiHandler(
  async (context: ApiRequestContext, userId: string, userRole: string, request: NextRequest) => {
    // Only artists can update content
    if (userRole !== 'ARTIST') {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Only artists can update content',
        403,
        undefined,
        context.requestId,
        userId
      );
    }

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('id');

    if (!contentId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Content ID is required',
        400,
        { parameter: 'id' },
        context.requestId,
        userId
      );
    }

    // Verify content ownership
    const existingContent = await prisma.content.findFirst({
      where: {
        id: contentId,
        artistId: userId,
      },
    });

    if (!existingContent) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Content not found or access denied',
        404,
        { contentId },
        context.requestId,
        userId
      );
    }

    // Parse and validate update data
    const body = await request.json();
    const validatedData = validateApiRequest(createContentSchema.partial(), body, context);

    // Validate tier ownership if specified
    if (validatedData.tierIds && validatedData.tierIds.length > 0) {
      const userTiers = await prisma.tiers.findMany({
        where: {
          id: { in: validatedData.tierIds },
          artistId: userId,
          isActive: true,
        },
        select: { id: true },
      });

      if (userTiers.length !== validatedData.tierIds.length) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          'One or more specified tiers do not exist or are not owned by you',
          403,
          {
            requestedTiers: validatedData.tierIds,
            validTiers: userTiers.map(t => t.id),
          },
          context.requestId,
          userId
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
        users: {
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
      tags: JSON.parse(updatedContent.tags || '[]'),
      commentCount: updatedContent._count.comments,
      _count: undefined,
    };

    return formattedContent;
  }
);

/**
 * Key improvements in this migrated version:
 *
 * 1. **Unified Error Handling**: Uses withAuthenticatedApiHandler for consistent error handling
 * 2. **Structured Validation**: Uses validateApiRequest for input validation with proper error formatting
 * 3. **Consistent Response Format**: All responses follow StandardApiResponse structure
 * 4. **Proper Error Types**: Uses AppError with specific error codes instead of generic responses
 * 5. **Request Context**: All operations include proper request context for logging
 * 6. **Automatic Logging**: Request/response logging is handled automatically by the wrapper
 * 7. **Type Safety**: Full TypeScript typing throughout
 * 8. **Error Details**: Development vs production error details handled automatically
 * 9. **Request ID Tracking**: Every request gets a unique ID for debugging
 * 10. **User Context**: User information is properly tracked in all operations
 *
 * Migration steps for existing routes:
 * 1. Replace manual try-catch with withApiHandler or withAuthenticatedApiHandler
 * 2. Replace custom validation with validateApiRequest
 * 3. Replace NextResponse.json calls with return statements (auto-wrapped)
 * 4. Replace manual error responses with AppError throws
 * 5. Remove manual logging (handled automatically)
 * 6. Update response format to match StandardApiResponse
 */
