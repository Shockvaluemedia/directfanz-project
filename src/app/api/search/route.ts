import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const searchSchema = z.object({
  query: z.string().max(100).default(''),
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

      // Handle special search modes before regular search
      const isSuggestions = searchParams.get('suggestions') === 'true';
      const isTrending = searchParams.get('trending') === 'true';
      const isFeatured = searchParams.get('featured') === 'true';
      const query = searchParams.get('q') || searchParams.get('query') || '';
      const limit = parseInt(searchParams.get('limit') || '20');

      // --- Suggestions mode ---
      if (isSuggestions && query) {
        const suggestions = await getSuggestions(query, limit);
        return NextResponse.json({ success: true, suggestions });
      }

      // --- Trending mode ---
      if (isTrending) {
        const trending = await getTrending(searchParams.get('category') || undefined, limit);
        return NextResponse.json({ success: true, trending });
      }

      // --- Featured mode ---
      if (isFeatured) {
        const results = await getFeatured(limit);
        return NextResponse.json({ success: true, results });
      }

      // --- Regular search ---
      if (!query) {
        return NextResponse.json({
          success: true,
          data: { artists: [], content: [], total: 0, query: '' },
          pagination: { limit, offset: 0, total: 0, hasNext: false },
        });
      }

      const params: SearchParams = searchSchema.parse({
        query,
        type: searchParams.get('type') || searchParams.get('types') || 'all',
        limit,
        offset: parseInt(searchParams.get('offset') || searchParams.get('page') || '0'),
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
            OR: [
              { displayName: { contains: params.query, mode: 'insensitive' } },
              { bio: { contains: params.query, mode: 'insensitive' } },
            ],
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
            _count: { select: { content: true, tiers: true } },
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
          contentCount: artist._count.content,
          tierCount: artist._count.tiers,
          lowestPrice: artist.tiers.length > 0 ? artist.tiers[0].minimumPrice : null,
          isVerified: artist.artists?.isStripeOnboarded || false,
        }));
      }

      // Search content
      if (params.type === 'content' || params.type === 'all') {
        const contentOrderBy = getContentOrderBy(params.sortBy);

        const content = await prisma.content.findMany({
          where: {
            visibility: 'PUBLIC',
            OR: [
              { title: { contains: params.query, mode: 'insensitive' } },
              { description: { contains: params.query, mode: 'insensitive' } },
              { tags: { contains: params.query, mode: 'insensitive' } },
            ],
            ...(params.contentType && { type: params.contentType }),
          },
          include: {
            users: { select: { id: true, displayName: true, avatar: true } },
            _count: { select: { comments: true, content_likes: true } },
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
          totalViews: item.totalViews,
          totalLikes: item.totalLikes,
          createdAt: item.createdAt,
          artist: item.users,
          commentCount: item._count.comments,
          likeCount: item._count.content_likes,
        }));
      }

      // Get total counts
      if (params.type === 'artists' || params.type === 'all') {
        results.total += await prisma.users.count({
          where: {
            role: 'ARTIST',
            OR: [
              { displayName: { contains: params.query, mode: 'insensitive' } },
              { bio: { contains: params.query, mode: 'insensitive' } },
            ],
          },
        });
      }
      if (params.type === 'content' || params.type === 'all') {
        results.total += await prisma.content.count({
          where: {
            visibility: 'PUBLIC',
            OR: [
              { title: { contains: params.query, mode: 'insensitive' } },
              { description: { contains: params.query, mode: 'insensitive' } },
              { tags: { contains: params.query, mode: 'insensitive' } },
            ],
            ...(params.contentType && { type: params.contentType }),
          },
        });
      }

      logger.info('Search performed', {
        userId: req.user?.id,
        query: params.query,
        type: params.type,
        resultsCount: results.artists.length + results.content.length,
      });

      return NextResponse.json({
        success: true,
        results: [...results.artists, ...results.content],
        data: results,
        total: results.total,
        hasMore: params.offset + params.limit < results.total,
        page: Math.floor(params.offset / params.limit),
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
          { error: 'Invalid search parameters', details: error.errors },
          { status: 400 }
        );
      }

      logger.error('Search endpoint error', {}, error as Error);
      return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
    }
  });
}

// --- Helper functions ---

async function getSuggestions(query: string, limit: number) {
  // Find matching artists and content titles
  const [artists, content] = await Promise.all([
    prisma.users.findMany({
      where: {
        role: 'ARTIST',
        displayName: { contains: query, mode: 'insensitive' },
      },
      take: Math.min(limit, 3),
      select: { displayName: true },
    }),
    prisma.content.findMany({
      where: {
        visibility: 'PUBLIC',
        title: { contains: query, mode: 'insensitive' },
      },
      take: Math.min(limit, 3),
      select: { title: true },
      distinct: ['title'],
    }),
  ]);

  return [
    ...artists.map(a => ({ text: a.displayName, type: 'creator' as const, count: 0 })),
    ...content.map(c => ({ text: c.title, type: 'query' as const, count: 0 })),
  ];
}

async function getTrending(_category: string | undefined, limit: number) {
  // Get content with most views in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const trending = await prisma.content.findMany({
    where: {
      visibility: 'PUBLIC',
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { totalViews: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      totalViews: true,
      thumbnailUrl: true,
      users: { select: { displayName: true } },
    },
  });

  return trending.map((item, i) => ({
    id: item.id,
    title: item.title,
    type: 'content' as const,
    trendScore: Math.max(100 - i * 10, 10),
    change: 0,
    thumbnailUrl: item.thumbnailUrl,
    creator: item.users.displayName,
  }));
}

async function getFeatured(limit: number) {
  // Get featured/popular content
  const content = await prisma.content.findMany({
    where: { visibility: 'PUBLIC' },
    orderBy: { totalViews: 'desc' },
    take: limit,
    include: {
      users: { select: { id: true, displayName: true, avatar: true } },
    },
  });

  return content.map(item => ({
    id: item.id,
    type: 'content',
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    contentType: item.type.toLowerCase(),
    creator: {
      id: item.users.id,
      name: item.users.displayName,
      avatar: item.users.avatar,
      verified: true,
      followerCount: 0,
    },
    metrics: {
      views: item.totalViews,
      likes: item.totalLikes,
      comments: 0,
      shares: 0,
      rating: 0,
    },
    tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()) : [],
    category: item.type,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function getArtistOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'popular':
      return { artists: { totalSubscribers: 'desc' as const } };
    default:
      return { displayName: 'asc' as const };
  }
}

function getContentOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'popular':
      return { totalViews: 'desc' as const };
    default:
      return { createdAt: 'desc' as const };
  }
}
