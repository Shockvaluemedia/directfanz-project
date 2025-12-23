import { NextRequest, NextResponse } from 'next/server';
import { handleMediaConvertWebhook } from '@/lib/vod-service';

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from AWS (in production, you'd verify the signature)
    const userAgent = request.headers.get('user-agent');
    if (!userAgent?.includes('Amazon')) {
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
    console.error('MediaConvert webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}