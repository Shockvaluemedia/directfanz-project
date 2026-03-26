import { NextRequest } from 'next/server';
import { handleMediaConvertWebhook } from '@/lib/vod-service';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

/**
 * @deprecated This webhook handler is legacy and will be replaced
 * with a platform-agnostic transcoding service webhook.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity via shared secret header
    const webhookSecret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.MEDIACONVERT_WEBHOOK_SECRET;

    if (!expectedSecret) {
      logger.error('MEDIACONVERT_WEBHOOK_SECRET is not configured');
      return apiError('INTERNAL_ERROR', 'Webhook not configured');
    }

    if (webhookSecret !== expectedSecret) {
      logger.warn('MediaConvert webhook unauthorized request', {
        hasSecret: !!webhookSecret,
      });
      return apiError('UNAUTHORIZED', 'Unauthorized');
    }

    const body = await request.json();

    // Handle different event types
    if (body.source === 'aws.mediaconvert') {
      await handleMediaConvertWebhook(body);

      return apiSuccess({
        message: 'Webhook processed successfully',
        eventType: body['detail-type'],
        jobId: body.detail?.jobId,
      });
    }

    return apiError('BAD_REQUEST', 'Unknown event source');
  } catch (error) {
    logger.error('MediaConvert webhook error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'Webhook processing failed');
  }
}
