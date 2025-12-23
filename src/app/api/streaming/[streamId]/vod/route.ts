import { NextRequest, NextResponse } from 'next/server';
import { withStreamManagement } from '@/lib/streaming-auth';
import { MediaConvert } from 'aws-sdk';

// Initialize MediaConvert client
const mediaConvert = new MediaConvert({
  region: process.env.AWS_REGION || 'us-east-1',
});

export async function POST(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement(request, async (req) => {
    try {
      const { streamId } = params;
      const body = await request.json();
      const { recordingKey, title, description } = body;

      if (!streamId || !recordingKey) {
        return NextResponse.json(
          { error: 'Stream ID and recording key are required' },
          { status: 400 }
        );
      }

      // Construct S3 paths
      const inputBucket = process.env.STREAMING_RECORDINGS_BUCKET;
      const outputBucket = process.env.VOD_CONTENT_BUCKET;
      
      if (!inputBucket || !outputBucket) {
        return NextResponse.json(
          { error: 'Storage buckets not configured' },
          { status: 500 }
        );
      }

      const inputUri = `s3://${inputBucket}/${recordingKey}`;
      const outputUri = `s3://${outputBucket}/vod/${streamId}/`;

      // Create MediaConvert job settings
      const jobSettings = {
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
          OutputGroups: [
            {
              Name: "HLS VOD Output Group",
              OutputGroupSettings: {
                Type: "HLS_GROUP_SETTINGS",
                HlsGroupSettings: {
                  Destination: outputUri,
                  SegmentLength: 6,
                  MinSegmentLength: 0,
                  DirectoryStructure: "SINGLE_DIRECTORY",
                  ManifestDurationFormat: "FLOATING_POINT",
                  OutputSelection: "MANIFESTS_AND_SEGMENTS",
                  ProgramDateTime: "EXCLUDE",
                  SegmentationMode: "USE_SEGMENT_DURATION"
                }
              },
              Outputs: [
                {
                  NameModifier: "_1080p",
                  VideoDescription: {
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        Bitrate: 5000000,
                        RateControlMode: "CBR",
                        CodecProfile: "HIGH",
                        CodecLevel: "LEVEL_4_1",
                        FramerateControl: "SPECIFIED",
                        FramerateNumerator: 30,
                        FramerateDenominator: 1,
                        GopBReference: "DISABLED",
                        GopClosedCadence: 1,
                        GopNumBFrames: 2,
                        GopSize: 90,
                        GopSizeUnits: "FRAMES",
                        MaxBitrate: 5000000,
                        NumRefFrames: 3,
                        ParControl: "SPECIFIED",
                        ParNumerator: 1,
                        ParDenominator: 1,
                        Profile: "HIGH",
                        SceneChangeDetect: "ENABLED"
                      }
                    },
                    Width: 1920,
                    Height: 1080
                  },
                  AudioDescriptions: [{
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 128000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48000,
                        Profile: "LC",
                        RateControlMode: "CBR"
                      }
                    }
                  }]
                },
                {
                  NameModifier: "_720p",
                  VideoDescription: {
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        Bitrate: 3000000,
                        RateControlMode: "CBR",
                        CodecProfile: "HIGH",
                        CodecLevel: "LEVEL_4_1",
                        FramerateControl: "SPECIFIED",
                        FramerateNumerator: 30,
                        FramerateDenominator: 1,
                        GopBReference: "DISABLED",
                        GopClosedCadence: 1,
                        GopNumBFrames: 2,
                        GopSize: 90,
                        GopSizeUnits: "FRAMES",
                        MaxBitrate: 3000000,
                        NumRefFrames: 3,
                        ParControl: "SPECIFIED",
                        ParNumerator: 1,
                        ParDenominator: 1,
                        Profile: "HIGH",
                        SceneChangeDetect: "ENABLED"
                      }
                    },
                    Width: 1280,
                    Height: 720
                  },
                  AudioDescriptions: [{
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 128000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48000,
                        Profile: "LC",
                        RateControlMode: "CBR"
                      }
                    }
                  }]
                },
                {
                  NameModifier: "_480p",
                  VideoDescription: {
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        Bitrate: 1500000,
                        RateControlMode: "CBR",
                        CodecProfile: "HIGH",
                        CodecLevel: "LEVEL_3_1",
                        FramerateControl: "SPECIFIED",
                        FramerateNumerator: 30,
                        FramerateDenominator: 1,
                        GopBReference: "DISABLED",
                        GopClosedCadence: 1,
                        GopNumBFrames: 2,
                        GopSize: 90,
                        GopSizeUnits: "FRAMES",
                        MaxBitrate: 1500000,
                        NumRefFrames: 3,
                        ParControl: "SPECIFIED",
                        ParNumerator: 1,
                        ParDenominator: 1,
                        Profile: "HIGH",
                        SceneChangeDetect: "ENABLED"
                      }
                    },
                    Width: 854,
                    Height: 480
                  },
                  AudioDescriptions: [{
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 128000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48000,
                        Profile: "LC",
                        RateControlMode: "CBR"
                      }
                    }
                  }]
                }
              ]
            },
            {
              Name: "MP4 Output Group",
              OutputGroupSettings: {
                Type: "FILE_GROUP_SETTINGS",
                FileGroupSettings: {
                  Destination: outputUri + "mp4/"
                }
              },
              Outputs: [{
                NameModifier: "_1080p",
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
                      Bitrate: 5000000,
                      RateControlMode: "CBR",
                      CodecProfile: "HIGH",
                      CodecLevel: "LEVEL_4_1"
                    }
                  },
                  Width: 1920,
                  Height: 1080
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
              }]
            }
          ],
          TimecodeConfig: {
            Source: "ZEROBASED"
          }
        },
        UserMetadata: {
          StreamId: streamId,
          Title: title || `VOD from Stream ${streamId}`,
          Description: description || '',
          CreatedBy: req.user.id,
          CreatedAt: new Date().toISOString()
        }
      };

      // Create MediaConvert job
      const result = await mediaConvert.createJob(jobSettings).promise();

      // TODO: Store VOD job information in database
      const vodRecord = {
        id: crypto.randomUUID(),
        streamId,
        userId: req.user.id,
        mediaConvertJobId: result.Job?.Id,
        title: title || `VOD from Stream ${streamId}`,
        description: description || '',
        status: 'processing',
        inputUri,
        outputUri,
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({
        vodId: vodRecord.id,
        jobId: result.Job?.Id,
        status: 'processing',
        title: vodRecord.title,
        description: vodRecord.description,
        estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // ~10 minutes
        outputFormats: ['hls', 'mp4'],
        qualities: ['1080p', '720p', '480p'],
      });
    } catch (error) {
      console.error('VOD conversion error:', error);
      return NextResponse.json(
        { error: 'Failed to start VOD conversion' },
        { status: 500 }
      );
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  return withStreamManagement(request, async (req) => {
    try {
      const { streamId } = params;

      if (!streamId) {
        return NextResponse.json(
          { error: 'Stream ID is required' },
          { status: 400 }
        );
      }

      // TODO: Get VOD records from database
      // For now, return mock data
      const vodRecords = [
        {
          id: 'vod-1',
          streamId,
          title: `VOD from Stream ${streamId}`,
          description: 'Recorded live stream',
          status: 'completed',
          duration: 3600, // seconds
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          hlsUrl: `https://vod-content.s3.amazonaws.com/vod/${streamId}/index.m3u8`,
          mp4Url: `https://vod-content.s3.amazonaws.com/vod/${streamId}/mp4/video_1080p.mp4`,
          thumbnailUrl: `https://vod-content.s3.amazonaws.com/vod/${streamId}/thumbnail.jpg`,
          qualities: ['1080p', '720p', '480p'],
        }
      ];

      return NextResponse.json({
        streamId,
        vodRecords,
        totalCount: vodRecords.length,
      });
    } catch (error) {
      console.error('VOD retrieval error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve VOD records' },
        { status: 500 }
      );
    }
  });
}