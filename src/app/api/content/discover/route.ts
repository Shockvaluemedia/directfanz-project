import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      visibility: 'PUBLIC' // Only show public content in discovery
    };

    // Add search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
        { artist: { displayName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Add type filter
    if (type && type !== 'all') {
      where.type = type.toUpperCase();
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'totalViews' || sortBy === 'totalLikes') {
      orderBy[sortBy] = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
    } else {
      orderBy.createdAt = 'desc'; // Default fallback
    }

    // Fetch content with pagination
    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          fileUrl: true,
          thumbnailUrl: true,
          visibility: true,
          tags: true,
          createdAt: true,
          totalViews: true,
          totalLikes: true,
          artist: {
            select: {
              id: true,
              displayName: true,
              avatar: true
            }
          },
          tiers: {
            select: {
              id: true,
              name: true,
              minimumPrice: true
            }
          }
        }
      }),
      prisma.content.count({ where })
    ]);

    // Transform tags from JSON string to array
    const transformedContent = content.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : [],
      likes: item.totalLikes,
      artist: {
        id: item.artist.id,
        name: item.artist.displayName,
        profileImage: item.artist.avatar
      },
      tiers: item.tiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        price: Number(tier.minimumPrice)
      }))
    }));

    return NextResponse.json({
      content: transformedContent,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Error fetching discovery content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}