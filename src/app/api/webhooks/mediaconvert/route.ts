import { NextRequest, NextResponse } from 'next/server';
import { handleMediaConvertWebhook } from '@/lib/vod-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity via shared secret header
    const webhookSecret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.MEDIACONVERT_WEBHOOK_SECRET;

    if (!expectedSecret) {
      logger.error('MEDIACONVERT_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    if (webhookSecret !== expectedSecret) {
      logger.warn('MediaConvert webhook unauthorized request', {
        hasSecret: !!webhookSecret,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Handle different event types
    if (body.source === 'aws.mediaconvert') {
      await handleMediaConvertWebhook(body);

      return NextResponse.json({
        message: 'Webhook processed successfully',
        eventType: body['detail-type'],
        jobId: body.detail?.jobId,
      });
    }

    return NextResponse.json(
      { error: 'Unknown event source' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('MediaConvert webhook error', {}, error as Error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
