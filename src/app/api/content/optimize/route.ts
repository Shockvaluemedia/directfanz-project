import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentOptimizer } from '@/lib/content-optimization';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const optimizeRequestSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  contentType: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
  strategy: z.enum(['auto', 'aggressive', 'balanced', 'quality', 'mobile', 'streaming']).optional(),
  targetDevice: z.enum(['mobile', 'tablet', 'desktop', 'tv']).optional(),
  targetConnection: z.enum(['2g', '3g', '4g', '5g', 'wifi']).optional(),
  preserveMetadata: z.boolean().optional(),
  contentId: z.string().optional(),
});

const batchOptimizeSchema = z.object({
  files: z.array(z.object({
    filePath: z.string(),
    contentType: z.enum(['IMAGE', 'VIDEO', 'AUDIO']),
    options: z.object({
      strategy: z.string().optional(),
      targetDevice: z.string().optional(),
      targetConnection: z.string().optional(),
    }).optional(),
  })).min(1, 'Files array cannot be empty').max(100, 'Too many files in batch request'),
  strategy: z.enum(['auto', 'aggressive', 'balanced', 'quality', 'mobile', 'streaming']).optional(),
  targetDevice: z.enum(['mobile', 'tablet', 'desktop', 'tv']).optional(),
  targetConnection: z.enum(['2g', '3g', '4g', '5g', 'wifi']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ARTIST') {
      return apiError('UNAUTHORIZED', 'Unauthorized access');
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return apiError('BAD_REQUEST', 'Invalid JSON body');
    }

    const { searchParams } = new URL(request.url);
    const isBatch = searchParams.get('batch') === 'true' || !!body.files;

    if (isBatch) {
      // Batch optimization
      const validatedData = batchOptimizeSchema.parse(body);
      
      const results = await contentOptimizer.batchOptimize(
        validatedData.files.map(file => ({
          path: file.filePath,
          type: file.contentType as any,
          options: {
            strategy: validatedData.strategy,
            targetDevice: validatedData.targetDevice,
            targetConnection: validatedData.targetConnection,
            enableAnalytics: true,
            artistId: session.user.id,
          },
        })),
        {
          strategy: validatedData.strategy,
          onProgress: (completed, total) => {
            // In a real implementation, you might want to emit progress via WebSocket
            logger.info(`Batch optimization progress: ${completed}/${total}`);
          },
        }
      );

      return apiSuccess({
          results,
          summary: {
            totalFiles: validatedData.files.length,
            successfulOptimizations: results.length,
            failedOptimizations: validatedData.files.length - results.length,
            totalSizeReduction: results.length > 0 ? results.reduce((sum, r) => sum + r.sizeReduction, 0) / results.length : 0,
            averageQualityScore: results.length > 0 ? results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length : 0,
            totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
          },
        });
    } else {
      // Single file optimization
      const validatedData = optimizeRequestSchema.parse(body);

      const result = await contentOptimizer.optimizeContent(
        validatedData.filePath,
        validatedData.contentType as any,
        {
          strategy: validatedData.strategy,
          targetDevice: validatedData.targetDevice,
          targetConnection: validatedData.targetConnection,
          preserveMetadata: validatedData.preserveMetadata,
          enableAnalytics: true,
          contentId: validatedData.contentId,
          artistId: session.user.id,
        }
      );

      return apiSuccess(result);
    }
  } catch (error) {
    logger.error('Content optimization error', {}, error as Error);

    if (error instanceof z.ZodError) {
      let errorMessage = 'Validation error';
      
      // Check for specific enum validation errors first
      const enumError = error.errors.find(err => err.code === 'invalid_enum_value');
      if (enumError) {
        const field = enumError.path[0];
        if (field === 'strategy') {
          errorMessage = 'Invalid strategy: ' + enumError.message;
        } else if (field === 'contentType') {
          errorMessage = 'Invalid contentType: ' + enumError.message;
        } else if (field === 'targetDevice') {
          errorMessage = 'Invalid targetDevice: ' + enumError.message;
        } else if (field === 'targetConnection') {
          errorMessage = 'Invalid targetConnection: ' + enumError.message;
        } else {
          errorMessage = `Invalid ${field}: ${enumError.message}`;
        }
      } else {
        // Fall back to other error types
        const firstError = error.errors[0];
        
        if (firstError.path.includes('filePath') || firstError.path.includes('contentType')) {
          errorMessage = 'Missing required fields: filePath and contentType are required';
        } else if (firstError.path.includes('files')) {
          if (firstError.message.includes('Too many')) {
            errorMessage = 'Too many files in batch request';
          } else {
            errorMessage = 'Files array cannot be empty';
          }
        }
      }
      
      return apiError('BAD_REQUEST', errorMessage);
    }

    if (error instanceof Error) {
      return apiError('INTERNAL_ERROR', error.message);
    }

    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// Get optimization strategies and recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'strategies'; // Default to strategies

    if (action === 'strategies') {
      // Return available optimization strategies (public endpoint)
      const { OPTIMIZATION_STRATEGIES } = await import('@/lib/content-optimization');
      
      return apiSuccess({
          strategies: Object.entries(OPTIMIZATION_STRATEGIES).map(([key, strategy]) => ({
            key,
            name: strategy.name,
            description: strategy.description,
          })),
        });
    }

    if (action === 'analyze') {
      // Analyze content and get recommendations (requires auth)
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.id) {
        return apiError('UNAUTHORIZED', 'Unauthorized access');
      }

      const filePath = searchParams.get('filePath');
      const contentType = searchParams.get('contentType');

      if (!filePath || !contentType) {
        return apiError('BAD_REQUEST', 'Missing required parameters: filePath and contentType');
      }

      const analysis = await contentOptimizer.analyzeContent(
        filePath,
        contentType as any
      );

      return apiSuccess({
          analysis,
          recommendations: {
            strategy: analysis.recommendedStrategy,
            estimatedSizeReduction: getEstimatedSizeReduction(analysis),
            estimatedQualityScore: getEstimatedQualityScore(analysis),
          },
        });
    }

    return apiError('BAD_REQUEST', 'Invalid action parameter');
  } catch (error) {
    logger.error('Content optimization GET error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Internal server error');
  }
}

// Helper functions
function getEstimatedSizeReduction(analysis: any): number {
  const { OPTIMIZATION_STRATEGIES } = require('@/lib/content-optimization');
  const strategy = OPTIMIZATION_STRATEGIES[analysis.recommendedStrategy];
  return strategy?.targetSizeReduction || 40;
}

function getEstimatedQualityScore(analysis: any): number {
  const { OPTIMIZATION_STRATEGIES } = require('@/lib/content-optimization');
  const strategy = OPTIMIZATION_STRATEGIES[analysis.recommendedStrategy];
  return strategy?.qualityThreshold || 85;
}