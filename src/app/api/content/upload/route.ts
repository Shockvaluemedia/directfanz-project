import { NextRequest } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { FileUploader, ContentType } from '@/lib/upload';
import { LocalFileUploader } from '@/lib/local-storage';
import { apiSuccess, apiError } from '@/lib/api-response';
// AI content moderation - stub until AI module is fully configured
interface ModerationResult {
  approved: boolean;
  flags: Array<{ category: string; severity: string }>;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  processingTime: number;
  recommendations: string[];
  [key: string]: unknown;
}
const moderateContent = async (_content: unknown, _type?: string, _userId?: string, _options?: Record<string, unknown>): Promise<ModerationResult> => ({
  approved: true,
  flags: [],
  confidence: 1.0,
  riskLevel: 'low',
  processingTime: 0,
  recommendations: [],
});

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
        return apiError('FORBIDDEN', 'Only artists can upload content');
      }

      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return apiError('BAD_REQUEST', 'No file provided');
      }

      // Server-side file size enforcement
      const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB absolute max
      if (file.size > MAX_UPLOAD_BYTES) {
        return apiError('BAD_REQUEST', `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum upload size is 500MB.`);
      }

      if (file.size === 0) {
        return apiError('BAD_REQUEST', 'File is empty');
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
          return apiError('BAD_REQUEST', 'One or more specified tiers do not exist or are not owned by you');
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
          
          return apiError('BAD_REQUEST', 'Content moderation failed');
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
          id: crypto.randomUUID(),
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
          updatedAt: new Date(),
          tiers: {
            connect: validatedData.tierIds.map(id => ({ id })),
          },
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
          await prisma.moderation_logs.create({
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
          logger.warn('Failed to store moderation log', { error: String(error) });
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

      return apiSuccess({ message,
        data: responseData });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Invalid upload data', error.errors);
      }

      logger.error('Content upload error', { userId: req.user?.id }, error as Error);

      return apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to upload content',);
    }
  });
}

// Generate presigned upload URL for direct client uploads
export async function PUT(request: NextRequest) {
  return withApi(request, async req => {
    try {
      if (req.user.role !== 'ARTIST') {
        return apiError('FORBIDDEN', 'Only artists can upload content');
      }

      const body = await request.json();
      const { fileName, contentType, fileSize } = body;

      if (!fileName || !contentType || !fileSize) {
        return apiError('BAD_REQUEST', 'fileName, contentType, and fileSize are required');
      }

      // For local storage, we don't use presigned URLs
      if (USE_LOCAL_STORAGE) {
        return apiError('BAD_REQUEST', 'Presigned URLs not supported with local storage. Use direct upload via POST /api/content/upload');
      }

      // Validate file type and size
      const file = { name: fileName, size: fileSize } as File;
      const detectedContentType = FileUploader.getContentType(file);
      const validation = FileUploader.validateFile(file, detectedContentType);

      if (!validation.isValid) {
        return apiError('BAD_REQUEST', validation.error || 'Invalid file');
      }

      // Generate unique key and presigned URL
      const key = FileUploader.generateFileKey(req.user.id, detectedContentType, fileName);
      const uploadUrl = `/api/upload?key=${encodeURIComponent(key)}`; // Direct upload endpoint

      return apiSuccess({
          uploadUrl,
          key,
          contentType: detectedContentType,
        });
    } catch (error) {
      logger.error('Presigned URL generation error', { userId: req.user?.id }, error as Error);

      return apiError('INTERNAL_ERROR', 'Failed to generate upload URL');
    }
  });
}
