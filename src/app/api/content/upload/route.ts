import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { FileUploader, ContentType } from '@/lib/upload';

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).default('PRIVATE'),
  tierIds: z.array(z.string().cuid()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  return withApi(request, async req => {
    try {
      // Check if user is an artist
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json({ error: 'Only artists can upload content' }, { status: 403 });
      }

      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Parse metadata
      const metadata = JSON.parse((formData.get('metadata') as string) || '{}');
      const validatedData = uploadSchema.parse(metadata);

      // Validate tier ownership if specified
      if (validatedData.tierIds.length > 0) {
        const userTiers = await prisma.tiers.findMany({
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

      logger.info('Starting file upload', {
        userId: req.user.id,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });

      // Upload and process file
      const uploadResult = await FileUploader.uploadFile(file, req.user.id);

      // Determine content type
      const contentType = FileUploader.getContentType(file);

      // Create content record in database
      const content = await prisma.content.create({
        data: {
          artistId: req.user.id,
          title: validatedData.title,
          description: validatedData.description,
          type: contentType,
          fileUrl: uploadResult.fileUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          fileSize: uploadResult.fileSize,
          duration: uploadResult.duration,
          format: uploadResult.format,
          tags: JSON.stringify(validatedData.tags),
          visibility: validatedData.visibility,
          tiers: {
            connect: validatedData.tierIds.map(id => ({ id })),
          },
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
        },
      });

      // Log successful upload
      logger.info('Content uploaded successfully', {
        contentId: content.id,
        userId: req.user.id,
        contentType,
        fileSize: uploadResult.fileSize,
      });

      return NextResponse.json({
        success: true,
        message: 'Content uploaded successfully',
        data: {
          ...content,
          tags: JSON.parse(content.tags),
          metadata: {
            width: uploadResult.width,
            height: uploadResult.height,
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid upload data',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      logger.error('Content upload error', { userId: req.user?.id }, error as Error);

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Failed to upload content',
        },
        { status: 500 }
      );
    }
  });
}

// Generate presigned upload URL for direct client uploads
export async function PUT(request: NextRequest) {
  return withApi(request, async req => {
    try {
      if (req.user.role !== 'ARTIST') {
        return NextResponse.json({ error: 'Only artists can upload content' }, { status: 403 });
      }

      const body = await request.json();
      const { fileName, contentType, fileSize } = body;

      if (!fileName || !contentType || !fileSize) {
        return NextResponse.json(
          { error: 'fileName, contentType, and fileSize are required' },
          { status: 400 }
        );
      }

      // Validate file type and size
      const file = { name: fileName, size: fileSize } as File;
      const detectedContentType = FileUploader.getContentType(file);
      const validation = FileUploader.validateFile(file, detectedContentType);

      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Generate unique key and presigned URL
      const key = FileUploader.generateFileKey(req.user.id, detectedContentType, fileName);
      const uploadUrl = await FileUploader.generatePresignedUploadUrl(key, contentType);

      return NextResponse.json({
        success: true,
        data: {
          uploadUrl,
          key,
          contentType: detectedContentType,
        },
      });
    } catch (error) {
      logger.error('Presigned URL generation error', { userId: req.user?.id }, error as Error);

      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
  });
}
