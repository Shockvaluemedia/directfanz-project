/**
 * VOD (Video on Demand) Service
 * Stub module — the previous AWS MediaConvert integration has been removed.
 * Replace with a platform-agnostic transcoding service (e.g., Mux, Cloudflare Stream).
 */

import { logger } from './logger';

export async function handleMediaConvertWebhook(body: any): Promise<void> {
  logger.warn('MediaConvert webhook received but service is deprecated', {
    eventType: body?.['detail-type'],
    jobId: body?.detail?.jobId,
  });
}
