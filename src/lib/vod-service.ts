import { MediaConvert, S3 } from 'aws-sdk';

// Initialize AWS services
const mediaConvert = new MediaConvert({
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

export interface VODJob {
  id: string;
  streamId: string;
  userId: string;
  mediaConvertJobId?: string;
  title: string;
  description?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  inputUri: string;
  outputUri: string;
  duration?: number;
  fileSize?: number;
  qualities: string[];
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface VODAsset {
  id: string;
  vodJobId: string;
  format: 'hls' | 'mp4' | 'thumbnail';
  quality: string;
  url: string;
  fileSize: number;
  duration?: number;
}

// Create VOD conversion job
export async function createVODJob(
  streamId: string,
  userId: string,
  recordingPath: string,
  options: {
    title?: string;
    description?: string;
    qualities?: string[];
    formats?: ('hls' | 'mp4')[];
  } = {}
): Promise<VODJob | null> {
  try {
    const {
      title = `VOD from Stream ${streamId}`,
      description = '',
      qualities = ['1080p', '720p', '480p'],
      formats = ['hls', 'mp4']
    } = options;

    const inputBucket = process.env.STREAMING_RECORDINGS_BUCKET;
    const outputBucket = process.env.VOD_CONTENT_BUCKET;
    
    if (!inputBucket || !outputBucket) {
      throw new Error('Storage buckets not configured');
    }

    const inputUri = `s3://${inputBucket}/${recordingPath}`;
    const outputUri = `s3://${outputBucket}/vod/${streamId}/`;

    // Verify input file exists
    try {
      await s3.headObject({
        Bucket: inputBucket,
        Key: recordingPath
      }).promise();
    } catch (error) {
      console.error('Input file not found:', error);
      return null;
    }

    // Create MediaConvert job settings
    const jobSettings = createMediaConvertJobSettings(
      inputUri,
      outputUri,
      qualities,
      formats,
      { title, description, streamId, userId }
    );

    // Submit MediaConvert job
    const result = await mediaConvert.createJob(jobSettings).promise();

    if (!result.Job?.Id) {
      throw new Error('Failed to create MediaConvert job');
    }

    // Create VOD job record
    const vodJob: VODJob = {
      id: crypto.randomUUID(),
      streamId,
      userId,
      mediaConvertJobId: result.Job.Id,
      title,
      description,
      status: 'processing',
      inputUri,
      outputUri,
      qualities,
      createdAt: new Date(),
    };

    // TODO: Store VOD job in database
    console.log('Created VOD job:', vodJob);

    return vodJob;
  } catch (error) {
    console.error('Error creating VOD job:', error);
    return null;
  }
}

// Check MediaConvert job status
export async function checkVODJobStatus(jobId: string): Promise<{
  status: string;
  progress?: number;
  errorMessage?: string;
}> {
  try {
    const result = await mediaConvert.getJob({ Id: jobId }).promise();
    
    const job = result.Job;
    if (!job) {
      throw new Error('Job not found');
    }

    return {
      status: job.Status || 'UNKNOWN',
      progress: job.JobPercentComplete,
      errorMessage: job.ErrorMessage,
    };
  } catch (error) {
    console.error('Error checking job status:', error);
    return {
      status: 'ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get VOD assets for a completed job
export async function getVODAssets(vodJobId: string, outputUri: string): Promise<VODAsset[]> {
  try {
    const assets: VODAsset[] = [];
    
    // Parse S3 URI
    const s3Uri = new URL(outputUri);
    const bucket = s3Uri.hostname;
    const prefix = s3Uri.pathname.substring(1); // Remove leading slash

    // List objects in output location
    const result = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
    }).promise();

    if (!result.Contents) {
      return assets;
    }

    // Process each file
    for (const object of result.Contents) {
      if (!object.Key || !object.Size) continue;

      const key = object.Key;
      const fileName = key.split('/').pop() || '';
      
      // Determine format and quality from filename
      let format: 'hls' | 'mp4' | 'thumbnail' = 'hls';
      let quality = 'unknown';

      if (fileName.endsWith('.m3u8')) {
        format = 'hls';
        if (fileName.includes('1080p')) quality = '1080p';
        else if (fileName.includes('720p')) quality = '720p';
        else if (fileName.includes('480p')) quality = '480p';
        else if (fileName === 'index.m3u8') quality = 'master';
      } else if (fileName.endsWith('.mp4')) {
        format = 'mp4';
        if (fileName.includes('1080p')) quality = '1080p';
        else if (fileName.includes('720p')) quality = '720p';
        else if (fileName.includes('480p')) quality = '480p';
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.png')) {
        format = 'thumbnail';
        quality = 'thumbnail';
      } else {
        continue; // Skip other files
      }

      const asset: VODAsset = {
        id: crypto.randomUUID(),
        vodJobId,
        format,
        quality,
        url: `https://${bucket}.s3.amazonaws.com/${key}`,
        fileSize: object.Size,
      };

      assets.push(asset);
    }

    return assets;
  } catch (error) {
    console.error('Error getting VOD assets:', error);
    return [];
  }
}

// Generate thumbnail from video
export async function generateThumbnail(
  inputUri: string,
  outputUri: string,
  timeOffset: number = 30 // seconds
): Promise<string | null> {
  try {
    const jobSettings = {
      Role: process.env.MEDIACONVERT_ROLE_ARN,
      Settings: {
        Inputs: [{
          FileInput: inputUri,
          InputClippings: [{
            StartTimecode: formatTimecode(timeOffset),
            EndTimecode: formatTimecode(timeOffset + 1)
          }]
        }],
        OutputGroups: [{
          Name: "Thumbnail Output Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: outputUri
            }
          },
          Outputs: [{
            NameModifier: "_thumbnail",
            ContainerSettings: {
              Container: "RAW"
            },
            VideoDescription: {
              CodecSettings: {
                Codec: "FRAME_CAPTURE",
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 1,
                  MaxCaptures: 1,
                  Quality: 80
                }
              },
              Width: 1280,
              Height: 720
            }
          }]
        }]
      }
    };

    const result = await mediaConvert.createJob(jobSettings).promise();
    return result.Job?.Id || null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

// Process completed stream recording
export async function processStreamRecording(
  streamId: string,
  userId: string,
  recordingPath: string,
  metadata: {
    title?: string;
    description?: string;
    duration?: number;
  } = {}
): Promise<VODJob | null> {
  try {
    console.log(`Processing stream recording: ${streamId}`);

    // Create VOD conversion job
    const vodJob = await createVODJob(streamId, userId, recordingPath, {
      title: metadata.title,
      description: metadata.description,
    });

    if (!vodJob) {
      throw new Error('Failed to create VOD job');
    }

    // Generate thumbnail (optional, can be done asynchronously)
    if (vodJob.outputUri) {
      generateThumbnail(
        vodJob.inputUri,
        vodJob.outputUri + 'thumbnails/',
        30 // 30 seconds into the video
      ).catch(error => {
        console.error('Thumbnail generation failed:', error);
      });
    }

    return vodJob;
  } catch (error) {
    console.error('Error processing stream recording:', error);
    return null;
  }
}

// Webhook handler for MediaConvert job completion
export async function handleMediaConvertWebhook(event: any): Promise<void> {
  try {
    const { detail } = event;
    const jobId = detail?.jobId;
    const status = detail?.status;

    if (!jobId) {
      console.error('No job ID in webhook event');
      return;
    }

    console.log(`MediaConvert job ${jobId} status: ${status}`);

    // TODO: Update VOD job status in database
    if (status === 'COMPLETE') {
      // Job completed successfully
      console.log(`VOD conversion completed for job ${jobId}`);
      
      // TODO: Notify user of completion
      // TODO: Update database with completion time and assets
    } else if (status === 'ERROR') {
      // Job failed
      console.error(`VOD conversion failed for job ${jobId}`);
      
      // TODO: Update database with error status
      // TODO: Notify user of failure
    }
  } catch (error) {
    console.error('Error handling MediaConvert webhook:', error);
  }
}

// Helper function to format timecode
function formatTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

// Helper function to create MediaConvert job settings
function createMediaConvertJobSettings(
  inputUri: string,
  outputUri: string,
  qualities: string[],
  formats: ('hls' | 'mp4')[],
  metadata: {
    title: string;
    description: string;
    streamId: string;
    userId: string;
  }
) {
  const outputGroups = [];

  // HLS output group
  if (formats.includes('hls')) {
    const hlsOutputs = qualities.map(quality => {
      const settings = getQualitySettings(quality);
      return {
        NameModifier: `_${quality}`,
        VideoDescription: {
          CodecSettings: {
            Codec: "H_264",
            H264Settings: {
              Bitrate: settings.bitrate,
              RateControlMode: "CBR",
              CodecProfile: "HIGH",
              CodecLevel: settings.level,
              FramerateControl: "SPECIFIED",
              FramerateNumerator: 30,
              FramerateDenominator: 1
            }
          },
          Width: settings.width,
          Height: settings.height
        },
        AudioDescriptions: [{
          CodecSettings: {
            Codec: "AAC",
            AacSettings: {
              Bitrate: 128000,
              CodingMode: "CODING_MODE_2_0",
              SampleRate: 48000
            }
          }
        }]
      };
    });

    outputGroups.push({
      Name: "HLS Output Group",
      OutputGroupSettings: {
        Type: "HLS_GROUP_SETTINGS",
        HlsGroupSettings: {
          Destination: outputUri + "hls/",
          SegmentLength: 6,
          MinSegmentLength: 0
        }
      },
      Outputs: hlsOutputs
    });
  }

  // MP4 output group
  if (formats.includes('mp4')) {
    const mp4Outputs = qualities.map(quality => {
      const settings = getQualitySettings(quality);
      return {
        NameModifier: `_${quality}`,
        ContainerSettings: {
          Container: "MP4",
          Mp4Settings: {
            CslgAtom: "INCLUDE",
            FreeSpaceBox: "EXCLUDE",
            MoovPlacement: "PROGRESSIVE_DOWNLOAD"
          }
        },
        VideoDescription: {
          CodecSettings: {
            Codec: "H_264",
            H264Settings: {
              Bitrate: settings.bitrate,
              RateControlMode: "CBR",
              CodecProfile: "HIGH",
              CodecLevel: settings.level
            }
          },
          Width: settings.width,
          Height: settings.height
        },
        AudioDescriptions: [{
          CodecSettings: {
            Codec: "AAC",
            AacSettings: {
              Bitrate: 128000,
              CodingMode: "CODING_MODE_2_0",
              SampleRate: 48000
            }
          }
        }]
      };
    });

    outputGroups.push({
      Name: "MP4 Output Group",
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS",
        FileGroupSettings: {
          Destination: outputUri + "mp4/"
        }
      },
      Outputs: mp4Outputs
    });
  }

  return {
    Role: process.env.MEDIACONVERT_ROLE_ARN,
    Settings: {
      Inputs: [{
        FileInput: inputUri,
        AudioSelectors: {
          "Audio Selector 1": {
            DefaultSelection: "DEFAULT"
          }
        },
        VideoSelector: {}
      }],
      OutputGroups: outputGroups,
      TimecodeConfig: {
        Source: "ZEROBASED"
      }
    },
    UserMetadata: {
      StreamId: metadata.streamId,
      Title: metadata.title,
      Description: metadata.description,
      CreatedBy: metadata.userId,
      CreatedAt: new Date().toISOString()
    }
  };
}

// Helper function to get quality settings
function getQualitySettings(quality: string) {
  const settings = {
    '1080p': { width: 1920, height: 1080, bitrate: 5000000, level: 'LEVEL_4_1' },
    '720p': { width: 1280, height: 720, bitrate: 3000000, level: 'LEVEL_4_1' },
    '480p': { width: 854, height: 480, bitrate: 1500000, level: 'LEVEL_3_1' },
    '360p': { width: 640, height: 360, bitrate: 1000000, level: 'LEVEL_3_1' },
    '240p': { width: 426, height: 240, bitrate: 600000, level: 'LEVEL_3_0' },
  };

  return settings[quality as keyof typeof settings] || settings['720p'];
}