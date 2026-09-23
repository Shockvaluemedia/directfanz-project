import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  adminContentSelect,
  dbStatusesForUiStatus,
  formatAdminContentItem,
} from '@/lib/admin-moderation';

const listSchema = z.object({
  status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED']).default('ALL'),
  type: z.string().optional(),
  search: z.string().optional(),
  artistId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/admin/content - the moderation queue behind the admin content page
export async function GET(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);
      const params = listSchema.parse({
        status: searchParams.get('status') ?? undefined,
        type: searchParams.get('type') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        artistId: searchParams.get('artistId') ?? undefined,
        limit: searchParams.get('limit') ?? undefined,
        offset: searchParams.get('offset') ?? undefined,
      });

      const where = {
        ...(params.status !== 'ALL' && { status: { in: dbStatusesForUiStatus(params.status) } }),
        ...(params.type && { type: params.type.toUpperCase() }),
        ...(params.artistId && { artistId: params.artistId }),
        ...(params.search && {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' as const } },
            { users: { displayName: { contains: params.search, mode: 'insensitive' as const } } },
            { users: { email: { contains: params.search, mode: 'insensitive' as const } } },
          ],
        }),
      };

      const [rows, total] = await Promise.all([
        prisma.content.findMany({
          where,
          select: adminContentSelect,
          orderBy: { createdAt: 'desc' },
          take: params.limit,
          skip: params.offset,
        }),
        prisma.content.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        content: rows.map(formatAdminContentItem),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total,
          hasNext: params.offset + params.limit < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid parameters', details: error.errors },
          { status: 400 }
        );
      }

      logger.error('Admin content list error', { adminUserId: req.user?.id }, error as Error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }
  });
}
