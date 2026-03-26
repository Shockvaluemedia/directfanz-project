/**
 * VOD (Video on Demand) Service — AWS MediaConvert integration
 *
 * Creates transcoding jobs that produce HLS outputs at multiple quality levels
 * and stores them in S3 for CloudFront delivery.
 */

import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CancelJobCommand,
  type CreateJobCommandInput,
} from '@aws-sdk/client-mediaconvert';
import { prisma } from './prisma';
import { logger } from './logger';

const REGION = process.env.AWS_REGION || 'us-east-1';
const MEDIACONVERT_ENDPOINT = process.env.AWS_MEDIACONVERT_ENDPOINT; // e.g. https://abc123.mediaconvert.us-east-1.amazonaws.com
const MEDIACONVERT_ROLE = process.env.AWS_MEDIACONVERT_ROLE_ARN || '';
const OUTPUT_BUCKET = process.env.AWS_S3_BUCKET_NAME || '';
const CDN_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN;

let client: MediaConvertClient | null = null;

function getClient(): MediaConvertClient {
  if (!client) {
    if (!MEDIACONVERT_ENDPOINT) {
      throw new Error('AWS_MEDIACONVERT_ENDPOINT is not configured');
    }
    client = new MediaConvertClient({
      region: REGION,
      endpoint: MEDIACONVERT_ENDPOINT,
    });
  }
  return client;
}

/** Quality presets for HLS output */
const QUALITY_PRESETS = [
  { name: '1080p', width: 1920, height: 1080, bitrate: 5_000_000, audioBitrate: 192_000 },
  { name: '720p', width: 1280, height: 720, bitrate: 3_000_000, audioBitrate: 128_000 },
  { name: '480p', width: 854, height: 480, bitrate: 1_500_000, audioBitrate: 128_000 },
  { name: '360p', width: 640, height: 360, bitrate: 800_000, audioBitrate: 96_000 },
];

export interface VodJobOptions {
  streamId: string;
  inputKey: string; // S3 key of the source recording
  title?: string;
  userId: string;
}

export interface VodJob {
  jobId: string;
  streamId: string;
  status: string;
  outputPrefix: string;
}

/**
 * Submit a MediaConvert job to transcode a stream recording into HLS.
 */
export async function createVodJob(options: VodJobOptions): Promise<VodJob> {
  const mc = getClient();
  const outputPrefix = `vod/${options.streamId}`;

  const hlsOutputs = QUALITY_PRESETS.map(preset => ({
    ContainerSettings: { Container: 'M3U8' as const },
    VideoDescription: {
      Width: preset.width,
      Height: preset.height,
      CodecSettings: {
        Codec: 'H_264' as const,
        H264Settings: {
          RateControlMode: 'QVBR' as const,
          MaxBitrate: preset.bitrate,
          QvbrSettings: { QvbrQualityLevel: 7 },
        },
      },
    },
    AudioDescriptions: [
      {
        CodecSettings: {
          Codec: 'AAC' as const,
          AacSettings: {
            Bitrate: preset.audioBitrate,
            CodingMode: 'CODING_MODE_2_0' as const,
            SampleRate: 48000,
          },
        },
      },
    ],
    NameModifier: `-${preset.name}`,
  }));

  const params: CreateJobCommandInput = {
    Role: MEDIACONVERT_ROLE,
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${OUTPUT_BUCKET}/${options.inputKey}`,
          AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' as const } },
        },
      ],
      OutputGroups: [
        {
          Name: 'HLS',
          OutputGroupSettings: {
            Type: 'HLS_GROUP_SETTINGS' as const,
            HlsGroupSettings: {
              Destination: `s3://${OUTPUT_BUCKET}/${outputPrefix}/`,
              SegmentLength: 6,
              MinSegmentLength: 0,
            },
          },
          Outputs: hlsOutputs as any,
        },
      ],
    },
    UserMetadata: {
      streamId: options.streamId,
      userId: options.userId,
    },
  };

  const command = new CreateJobCommand(params);
  const response = await mc.send(command);

  const jobId = response.Job?.Id ?? '';

  // Store the recording record in the database
  await prisma.stream_recordings.create({
    data: {
      id: crypto.randomUUID(),
      streamId: options.streamId,
      videoUrl: '', // Will be updated when job completes
      duration: 0,
      fileSize: 0,
      quality: '1080p',
      format: 'HLS',
      status: 'PROCESSING',
      updatedAt: new Date(),
    },
  });

  logger.info('MediaConvert job created', {
    jobId,
    streamId: options.streamId,
    outputPrefix,
  });

  return {
    jobId,
    streamId: options.streamId,
    status: 'PROCESSING',
    outputPrefix,
  };
}

/**
 * Check the status of a MediaConvert job.
 */
export async function getVodJobStatus(jobId: string) {
  const mc = getClient();
  const response = await mc.send(new GetJobCommand({ Id: jobId }));

  return {
    jobId,
    status: response.Job?.Status ?? 'UNKNOWN',
    errorMessage: response.Job?.ErrorMessage,
    percentComplete: response.Job?.JobPercentComplete,
    outputPrefix: response.Job?.Settings?.OutputGroups?.[0]?.OutputGroupSettings?.HlsGroupSettings?.Destination,
  };
}

/**
 * Cancel a MediaConvert job.
 */
export async function cancelVodJob(jobId: string): Promise<void> {
  const mc = getClient();
  await mc.send(new CancelJobCommand({ Id: jobId }));
  logger.info('MediaConvert job cancelled', { jobId });
}

/**
 * Handle MediaConvert completion webhook (called from /api/webhooks/mediaconvert).
 */
export async function handleMediaConvertWebhook(body: any): Promise<void> {
  const detailType = body?.['detail-type'];
  const detail = body?.detail;

  if (!detail?.jobId) {
    logger.warn('MediaConvert webhook missing jobId');
    return;
  }

  const jobId = detail.jobId;
  const streamId = detail.userMetadata?.streamId;
  const status = detail.status;

  logger.info('MediaConvert webhook received', { jobId, streamId, status, detailType });

  if (!streamId) return;

  if (status === 'COMPLETE') {
    const outputPrefix = detail.outputGroupDetails?.[0]?.outputDetails?.[0]?.outputFilePaths?.[0];
    const hlsUrl = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/vod/${streamId}/index.m3u8`
      : `https://${OUTPUT_BUCKET}.s3.${REGION}.amazonaws.com/vod/${streamId}/index.m3u8`;

    // Update the stream recording
    await prisma.stream_recordings.updateMany({
      where: { streamId, status: 'PROCESSING' },
      data: {
        videoUrl: hlsUrl,
        status: 'READY',
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('VOD ready', { streamId, hlsUrl });
  } else if (status === 'ERROR') {
    await prisma.stream_recordings.updateMany({
      where: { streamId, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        updatedAt: new Date(),
      },
    });

    logger.error('MediaConvert job failed', {
      jobId,
      streamId,
      errorMessage: detail.errorMessage,
    });
  }
}

/**
 * Get VOD playback URL for a stream.
 */
export async function getVodUrl(streamId: string): Promise<string | null> {
  const recording = await prisma.stream_recordings.findFirst({
    where: { streamId, status: 'READY' },
    orderBy: { createdAt: 'desc' },
    select: { videoUrl: true },
  });

  return recording?.videoUrl ?? null;
}
