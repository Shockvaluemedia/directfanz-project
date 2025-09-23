import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { FileUploader, ContentType } from '@/lib/upload';
import { LocalFileUploader } from '@/lib/local-storage';
import { moderateContent, ModerationResult } from '@/lib/ai-content-moderation';

// Use local storage if AWS is not configured
const USE_LOCAL_STORAGE = !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_S3_BUCKET_NAME;
const UploaderClass = USE_LOCAL_STORAGE ? LocalFileUploader : FileUploader;

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'TIER_LOCKED']).default('PRIVATE'),
  tierIds: z.array(z.string().cuid()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  skipModeration: z.boolean().optional().default(false), // Allow skipping for admin users
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

      logger.info('Starting file upload with AI moderation', {
        userId: req.user.id,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });

      // Step 1: AI Content Moderation (unless skipped by admin)
      let moderationResult: ModerationResult | null = null;
      const contentType = UploaderClass.getContentType(file);
      
      if (!validatedData.skipModeration) {
        logger.info('Running AI content moderation', {
          userId: req.user.id,
          fileName: file.name,
          contentType
        });
        
        moderationResult = await moderateContent(
          file,
          contentType,
          req.user.id,
          {
            title: validatedData.title,
            description: validatedData.description,
            tags: validatedData.tags,
            filename: file.name
          }
        );
        
        logger.info('AI moderation completed', {
          userId: req.user.id,
          fileName: file.name,
          approved: moderationResult.approved,
          riskLevel: moderationResult.riskLevel,
          flagsCount: moderationResult.flags.length,
          processingTime: moderationResult.processingTime
        });
        
        // Handle moderation result
        if (!moderationResult.approved) {
          logger.warn('Content rejected by AI moderation', {
            userId: req.user.id,
            fileName: file.name,
            flags: moderationResult.flags,
            riskLevel: moderationResult.riskLevel
          });
          
          return NextResponse.json({
            success: false,
            error: 'Content moderation failed',
            moderation: {
              approved: moderationResult.approved,
              riskLevel: moderationResult.riskLevel,
              flags: moderationResult.flags,
              recommendations: moderationResult.recommendations
            },
            message: 'Content did not pass AI moderation checks. Please review and try again.'
          }, { status: 400 });
        }
      } else {
        logger.info('AI moderation skipped (admin override)', {
          userId: req.user.id,
          fileName: file.name
        });
      }

      // Step 2: Upload and process file
      const uploadResult = await UploaderClass.uploadFile(file, req.user.id);

      // Determine content status based on moderation
      const contentStatus = moderationResult 
        ? (moderationResult.approved ? 'PUBLISHED' : 'PENDING_REVIEW')
        : 'PUBLISHED'; // If moderation was skipped
      
      const requiresReview = moderationResult && (
        moderationResult.riskLevel === 'high' || 
        moderationResult.riskLevel === 'critical' ||
        moderationResult.flags.some(f => f.severity === 'high' || f.severity === 'critical')
      );

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
          status: contentStatus,
          // Store moderation results in metadata
          metadata: JSON.stringify({
            moderation: moderationResult ? {
              approved: moderationResult.approved,
              confidence: moderationResult.confidence,
              riskLevel: moderationResult.riskLevel,
              flagsCount: moderationResult.flags.length,
              processingTime: moderationResult.processingTime,
              timestamp: new Date().toISOString()
            } : null,
            upload: {
              originalFileName: file.name,
              uploadTimestamp: new Date().toISOString()
            }
          }),
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

      // Store detailed moderation results separately for admin review if needed
      if (moderationResult && requiresReview) {
        try {
          await prisma.moderationLog.create({
            data: {
              contentId: content.id,
              userId: req.user.id,
              result: JSON.stringify(moderationResult),
              status: 'PENDING_REVIEW',
              createdAt: new Date()
            }
          }).catch(() => {
            // Table might not exist yet, just log it
            logger.info('Moderation log table not available - moderation data stored in content metadata');
          });
        } catch (error) {
          logger.warn('Failed to store moderation log', error);
        }
      }

      const responseData = {
        ...content,
        tags: JSON.parse(content.tags),
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
        },
        moderation: moderationResult ? {
          approved: moderationResult.approved,
          confidence: moderationResult.confidence,
          riskLevel: moderationResult.riskLevel,
          recommendations: moderationResult.recommendations,
          requiresReview
        } : null
      };

      const message = moderationResult 
        ? (requiresReview 
            ? 'Content uploaded but requires manual review before publishing'
            : 'Content uploaded and approved by AI moderation')
        : 'Content uploaded successfully';

      return NextResponse.json({
        success: true,
        message,
        data: responseData,
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

      // For local storage, we don't use presigned URLs
      if (USE_LOCAL_STORAGE) {
        return NextResponse.json({
          error: 'Presigned URLs not supported with local storage. Use direct upload via POST /api/content/upload'
        }, { status: 400 });
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
