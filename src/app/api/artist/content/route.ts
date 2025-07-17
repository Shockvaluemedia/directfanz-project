import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';
import { SUPPORTED_FILE_TYPES } from '@/lib/s3';
import { z } from 'zod';

const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  fileUrl: z.string().url('Invalid file URL'),
  fileSize: z.number().positive('File size must be positive'),
  format: z.string().min(1, 'Format is required'),
  duration: z.number().optional(),
  tags: z.array(z.string()).default([]),
  tierIds: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  thumbnailUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createContentSchema.parse(body);

    // Determine content type from format
    const contentType = Object.entries(SUPPORTED_FILE_TYPES).find(
      ([mimeType, info]) => info.extension === validatedData.format.toLowerCase()
    )?.[1]?.category;

    if (!contentType) {
      return NextResponse.json(
        { error: { code: 'INVALID_FORMAT', message: 'Unsupported file format' } },
        { status: 400 }
      );
    }

    // Verify that specified tiers belong to the artist
    if (validatedData.tierIds.length > 0) {
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

    // Create content record
    const content = await prisma.content.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        type: contentType,
        fileUrl: validatedData.fileUrl,
        thumbnailUrl: validatedData.thumbnailUrl,
        fileSize: validatedData.fileSize,
        duration: validatedData.duration,
        format: validatedData.format,
        tags: validatedData.tags,
        isPublic: validatedData.isPublic,
        artistId: session.user.id,
        tiers: {
          connect: validatedData.tierIds.map(id => ({ id })),
        },
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

    return NextResponse.json({
      success: true,
      data: content,
    });

  } catch (error) {
    console.error('Content creation error:', error);
    
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create content' } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Artist authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      artistId: session.user.id,
    };

    if (type && ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'].includes(type)) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    // Get content with pagination
    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          tiers: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        content,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error('Content fetch error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content' } },
      { status: 500 }
    );
  }
}