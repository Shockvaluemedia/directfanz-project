import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  type: z.enum(['artists', 'content', 'all']).default('all'),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z
    .enum(['relevance', 'newest', 'popular', 'price_low', 'price_high'])
    .default('relevance'),
  contentType: z.enum(['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT']).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

export async function GET(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const { searchParams } = new URL(request.url);

      const params: SearchParams = searchSchema.parse({
        query: searchParams.get('query') || '',
        type: searchParams.get('type') || 'all',
        limit: parseInt(searchParams.get('limit') || '20'),
        offset: parseInt(searchParams.get('offset') || '0'),
        sortBy: searchParams.get('sortBy') || 'relevance',
        contentType: searchParams.get('contentType') || undefined,
        minPrice: searchParams.get('minPrice')
          ? parseFloat(searchParams.get('minPrice')!)
          : undefined,
        maxPrice: searchParams.get('maxPrice')
          ? parseFloat(searchParams.get('maxPrice')!)
          : undefined,
      });

      const results = {
        artists: [] as any[],
        content: [] as any[],
        total: 0,
        query: params.query,
      };

      // Search artists
      if (params.type === 'artists' || params.type === 'all') {
        const artistOrderBy = getArtistOrderBy(params.sortBy);

        const artists = await prisma.users.findMany({
          where: {
            role: 'ARTIST',
            OR: [{ displayName: { contains: params.query } }, { bio: { contains: params.query } }],
          },
          include: {
            artists: true,
            tiers: {
              where: {
                isActive: true,
                ...(params.minPrice !== undefined && { minimumPrice: { gte: params.minPrice } }),
                ...(params.maxPrice !== undefined && { minimumPrice: { lte: params.maxPrice } }),
              },
              orderBy: { minimumPrice: 'asc' },
            },
            _count: {
              select: {
                content: true,
                tiers: true,
              },
            },
          },
          orderBy: artistOrderBy,
          take: params.type === 'artists' ? params.limit : Math.ceil(params.limit / 2),
          skip: params.offset,
        });

        results.artists = artists.map(artist => ({
          id: artist.id,
          displayName: artist.displayName,
          bio: artist.bio,
          avatar: artist.avatar,
          socialLinks: artist.socialLinks,
          totalSubscribers: artist.artists?.totalSubscribers || 0,
          totalEarnings: artist.artists?.totalEarnings || 0,
          contentCount: artist._count.content,
          tierCount: artist._count.tiers,
          lowestPrice: artist.tiers.length > 0 ? artist.tiers[0].minimumPrice : null,
          isVerified: artist.artists?.isStripeOnboarded || false,
        }));
      }

      // Search content
      if (params.type === 'content' || params.type === 'all') {
        const contentOrderBy = getContentOrderBy(params.sortBy);
        const contentWhere = {
          isPublic: true,
          OR: [
            { title: { contains: params.query } },
            { description: { contains: params.query } },
            { tags: { contains: params.query } },
          ],
          ...(params.contentType && { type: params.contentType }),
        };

        const content = await prisma.content.findMany({
          where: contentWhere,
          include: {
            artist: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            tiers: {
              where: {
                isActive: true,
                ...(params.minPrice !== undefined && { minimumPrice: { gte: params.minPrice } }),
                ...(params.maxPrice !== undefined && { minimumPrice: { lte: params.maxPrice } }),
              },
              select: {
                id: true,
                name: true,
                minimumPrice: true,
              },
              orderBy: { minimumPrice: 'asc' },
            },
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: contentOrderBy,
          take: params.type === 'content' ? params.limit : Math.ceil(params.limit / 2),
          skip: params.offset,
        });

        results.content = content.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          type: item.type,
          thumbnailUrl: item.thumbnailUrl,
          duration: item.duration,
          format: item.format,
          tags: item.tags,
          createdAt: item.createdAt,
          artist: item.artist,
          requiredTier: item.tiers.length > 0 ? item.tiers[0] : null,
          commentCount: item._count.comments,
        }));
      }

      // Get total count for pagination
      if (params.type === 'artists' || params.type === 'all') {
        const artistCount = await prisma.users.count({
          where: {
            role: 'ARTIST',
            OR: [{ displayName: { contains: params.query } }, { bio: { contains: params.query } }],
          },
        });
        results.total += artistCount;
      }

      if (params.type === 'content' || params.type === 'all') {
        const contentCount = await prisma.content.count({
          where: {
            visibility: 'PUBLIC',
            OR: [
              { title: { contains: params.query } },
              { description: { contains: params.query } },
              { tags: { contains: params.query } },
            ],
            ...(params.contentType && { type: params.contentType }),
          },
        });
        results.total += contentCount;
      }

      logger.info('Search performed', {
        userId: req.user?.id,
        query: params.query,
        type: params.type,
        resultsCount: results.artists.length + results.content.length,
      });

      return NextResponse.json({
        success: true,
        data: results,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total: results.total,
          hasNext: params.offset + params.limit < results.total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid search parameters',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Search endpoint error', {}, error as Error);
      return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
    }
  });
}

function getArtistOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'popular':
      return { artists: { totalSubscribers: 'desc' as const } };
    case 'price_low':
      return { displayName: 'asc' as const }; // Will need tier-based sorting in complex query
    case 'price_high':
      return { displayName: 'asc' as const }; // Will need tier-based sorting in complex query
    default:
      return { displayName: 'asc' as const }; // Relevance fallback to alphabetical
  }
}

function getContentOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'popular':
      return { createdAt: 'desc' as const }; // Would need view/engagement tracking for true popularity
    default:
      return { createdAt: 'desc' as const }; // Relevance fallback to newest
  }
}
