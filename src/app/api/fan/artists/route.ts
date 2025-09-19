import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeParseURL } from '@/lib/api-utils';
import { z } from 'zod';

const searchSchema = z.object({
  search: z.string().optional(),
  genre: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify they are a fan
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can discover artists' }, { status: 403 });
    }

    const url = safeParseURL(request);
    const searchParams = url?.searchParams || new URLSearchParams();
    const params = {
      search: searchParams.get('search') || undefined,
      genre: searchParams.get('genre') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const { search, genre, tags, limit, offset } = searchSchema.parse(params);

    // Build where clause for filtering
    const whereClause: any = {
      role: 'ARTIST',
      artists: {
        isStripeOnboarded: true, // Only show artists who can accept payments
      },
      tiers: {
        some: {
          isActive: true, // Only show artists with active tiers
        },
      },
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        {
          displayName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          bio: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Get artists with their tiers and basic stats
    const artists = await prisma.users.findMany({
      where: whereClause,
      select: {
        id: true,
        displayName: true,
        bio: true,
        avatar: true,
        socialLinks: true,
        createdAt: true,
        artists: {
          select: {
            totalSubscribers: true,
            totalEarnings: true,
          },
        },
        tiers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            minimumPrice: true,
            subscriberCount: true,
          },
          orderBy: { minimumPrice: 'asc' },
        },
        content: {
          where: { visibility: 'PUBLIC' },
          select: {
            id: true,
            title: true,
            type: true,
            thumbnailUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3, // Show latest 3 public content items
        },
      },
      orderBy: [{ artists: { totalSubscribers: 'desc' } }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
    });

    // Get total count for pagination
    const totalCount = await prisma.users.count({
      where: whereClause,
    });

    return NextResponse.json({
      artists,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Get artists error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 });
  }
}
