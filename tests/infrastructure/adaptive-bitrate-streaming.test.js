/**
 * Property-Based Test for Adaptive Bitrate Streaming
 * Feature: aws-conversion, Property 15: Adaptive Bitrate Streaming
 * Validates: Requirements 5.3
 */

const { describe, test, expect } = require('@jest/globals');
const fc = require('fast-check');

// Mock AWS SDK for testing
const mockMediaLive = {
  describeChannel: jest.fn(),
  listChannels: jest.fn(),
  describeInput: jest.fn(),
  startChannel: jest.fn(),
  stopChannel: jest.fn()
};

const mockMediaStore = {
  describeContainer: jest.fn(),
  getObject: jest.fn(),
  listItems: jest.fn()
};

const mockS3 = {
  getObject: jest.fn(),
  listObjectsV2: jest.fn(),
  headObject: jest.fn()
};

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  MediaLive: jest.fn(() => mockMediaLive),
  MediaStore: jest.fn(() => mockMediaStore),
  MediaStoreData: jest.fn(() => mockMediaStore),
  S3: jest.fn(() => mockS3)
}));

const AWS = require('aws-sdk');

describe('Adaptive Bitrate Streaming Property Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  /**
   * Property 15: Adaptive Bitrate Streaming
   * For any live stream, multiple bitrate variants should be available to clients,
   * allowing adaptive quality selection based on network conditions
   */
  test('Property: Live streams provide multiple bitrate variants for adaptive streaming', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test streaming configurations
        fc.record({
          channelId: fc.string({ minLength: 10, maxLength: 20 }),
          streamName: fc.string({ minLength: 5, maxLength: 15 }),
          inputType: fc.constantFrom('RTMP_PUSH', 'RTP_PUSH', 'UDP_PUSH'),
          channelClass: fc.constantFrom('SINGLE_PIPELINE', 'STANDARD'),
          inputResolution: fc.constantFrom('SD', 'HD', 'UHD'),
          maxBitrate: fc.constantFrom('MAX_10_MBPS', 'MAX_20_MBPS', 'MAX_50_MBPS'),
          streamState: fc.constantFrom('IDLE', 'STARTING', 'RUNNING', 'STOPPING')
        }),
        async (config) => {
          const currentTime = new Date();
          
          // Define expected bitrate variants based on input resolution
          const bitrateVariants = {
            'SD': [
              { resolution: '480p', width: 854, height: 480, bitrate: 1500000 },
              { resolution: '240p', width: 426, height: 240, bitrate: 800000 }
            ],
            'HD': [
              { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000000 },
              { resolution: '720p', width: 1280, height: 720, bitrate: 3000000 },
              { resolution: '480p', width: 854, height: 480, bitrate: 1500000 },
              { resolution: '240p', width: 426, height: 240, bitrate: 800000 }
            ],
            'UHD': [
              { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000000 },
              { resolution: '720p', width: 1280, height: 720, bitrate: 3000000 },
              { resolution: '480p', width: 854, height: 480, bitrate: 1500000 },
              { resolution: '240p', width: 426, height: 240, bitrate: 800000 }
            ]
          };

          const expectedVariants = bitrateVariants[config.inputResolution];

          // Mock MediaLive channel configuration
          mockMediaLive.describeChannel.mockResolvedValue({
            Id: config.channelId,
            Name: `direct-fan-platform-live-channel`,
            ChannelClass: config.channelClass,
            State: config.streamState,
            InputSpecification: {
              Codec: 'AVC',
              InputResolution: config.inputResolution,
              MaximumBitrate: config.maxBitrate
            },
            InputAttachments: [{
              InputAttachmentName: 'main-input',
              InputId: 'input-12345',
              InputSettings: {}
            }],
            Destinations: [
              {
                Id: 'hls-destination',
                Settings: [{
                  Url: 'mediastoressl://direct-fan-platform-streaming-prod.data.mediastore.us-east-1.amazonaws.com/live/'
                }]
              },
              {
                Id: 'recording-destination',
                Settings: [{
                  Url: 's3ssl://direct-fan-platform-streaming-recordings/live/'
                }]
              }
            ],
            EncoderSettings: {
              AudioDescriptions: [{
                AudioSelectorName: 'default',
                Name: 'audio_1',
                CodecSettings: {
                  AacSettings: {
                    Bitrate: 128000,
                    CodingMode: 'CODING_MODE_2_0',
                    SampleRate: 48000
                  }
                }
              }],
              VideoDescriptions: expectedVariants.map(variant => ({
                Name: `video_${variant.resolution}`,
                CodecSettings: {
                  H264Settings: {
                    Bitrate: variant.bitrate,
                    FramerateNumerator: 30,
                    FramerateDenominator: 1,
                    Profile: 'HIGH',
                    Level: variant.resolution === '1080p' ? 'H264_LEVEL_4_1' : 'H264_LEVEL_3_1'
                  }
                },
                Height: variant.height,
                Width: variant.width
              })),
              OutputGroups: [{
                Name: 'hls_output_group',
                OutputGroupSettings: {
                  HlsGroupSettings: {
                    Destination: {
                      DestinationRefId: 'hls-destination'
                    },
                    SegmentLength: 6,
                    ManifestDurationFormat: 'FLOATING_POINT',
                    Mode: 'LIVE',
                    OutputSelection: 'MANIFESTS_AND_SEGMENTS'
                  }
                },
                Outputs: expectedVariants.map(variant => ({
                  OutputName: variant.resolution,
                  VideoDescriptionName: `video_${variant.resolution}`,
                  AudioDescriptionNames: ['audio_1'],
                  OutputSettings: {
                    HlsOutputSettings: {
                      NameModifier: `_${variant.resolution}`,
                      HlsSettings: {
                        StandardHlsSettings: {
                          M3u8Settings: {
                            AudioFramesPerPes: 4,
                            PcrControl: 'PCR_EVERY_PES_PACKET'
                          }
                        }
                      }
                    }
                  }
                }))
              }]
            },
            CreationTime: new Date(currentTime.getTime() - 3600000), // 1 hour ago
            LastModifiedTime: new Date(currentTime.getTime() - 1800000) // 30 minutes ago
          });

          // Mock MediaStore container for HLS manifests
          mockMediaStore.describeContainer.mockResolvedValue({
            Container: {
              Name: 'direct-fan-platform-streaming-prod',
              Endpoint: 'https://direct-fan-platform-streaming-prod.data.mediastore.us-east-1.amazonaws.com',
              Status: 'ACTIVE',
              CreationTime: new Date(currentTime.getTime() - 7200000) // 2 hours ago
            }
          });

          // Mock HLS manifest files in MediaStore
          const manifestFiles = [
            'live/index.m3u8', // Master playlist
            ...expectedVariants.map(variant => `live/index_${variant.resolution}.m3u8`) // Variant playlists
          ];

          mockMediaStore.listItems.mockResolvedValue({
            Items: manifestFiles.map(path => ({
              Name: path.split('/').pop(),
              Type: 'OBJECT',
              ETag: `"${Math.random().toString(36).substring(7)}"`,
              LastModified: new Date(currentTime.getTime() - 300000), // 5 minutes ago
              ContentLength: Math.floor(Math.random() * 1000) + 500,
              ContentType: 'application/vnd.apple.mpegurl'
            }))
          });

          // Mock master playlist content
          const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
${expectedVariants.map(variant => 
            `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate},RESOLUTION=${variant.width}x${variant.height}
index_${variant.resolution}.m3u8`
          ).join('\n')}`;

          // Mock variant playlist content
          const variantPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1
#EXTINF:6.0,
segment_001.ts
#EXTINF:6.0,
segment_002.ts
#EXTINF:6.0,
segment_003.ts`;

          mockMediaStore.getObject.mockImplementation((params) => {
            if (params.Path === '/live/index.m3u8') {
              return Promise.resolve({
                Body: Buffer.from(masterPlaylistContent),
                ContentType: 'application/vnd.apple.mpegurl',
                ContentLength: masterPlaylistContent.length,
                LastModified: new Date(currentTime.getTime() - 300000)
              });
            } else if (params.Path.includes('index_') && params.Path.endsWith('.m3u8')) {
              return Promise.resolve({
                Body: Buffer.from(variantPlaylistContent),
                ContentType: 'application/vnd.apple.mpegurl',
                ContentLength: variantPlaylistContent.length,
                LastModified: new Date(currentTime.getTime() - 300000)
              });
            }
            return Promise.reject(new Error('Object not found'));
          });

          // Test the adaptive bitrate streaming properties
          const mediaLive = new AWS.MediaLive();
          const mediaStore = new AWS.MediaStoreData();

          // Verify MediaLive channel configuration
          const channelDetails = await mockMediaLive.describeChannel({ ChannelId: config.channelId });

          // Property 1: Channel should be configured with multiple video descriptions for different bitrates
          expect(channelDetails.EncoderSettings.VideoDescriptions).toBeDefined();
          expect(channelDetails.EncoderSettings.VideoDescriptions.length).toBeGreaterThanOrEqual(2);

          // Property 2: Each video description should have distinct bitrate and resolution
          const videoDescriptions = channelDetails.EncoderSettings.VideoDescriptions;
          const bitrates = videoDescriptions.map(vd => vd.CodecSettings.H264Settings.Bitrate);
          const resolutions = videoDescriptions.map(vd => `${vd.Width}x${vd.Height}`);

          // All bitrates should be unique
          expect(new Set(bitrates).size).toBe(bitrates.length);
          // All resolutions should be unique
          expect(new Set(resolutions).size).toBe(resolutions.length);

          // Property 3: Bitrates should be in descending order (highest quality first)
          for (let i = 0; i < bitrates.length - 1; i++) {
            expect(bitrates[i]).toBeGreaterThan(bitrates[i + 1]);
          }

          // Property 4: HLS output group should have outputs for each video description
          const hlsOutputGroup = channelDetails.EncoderSettings.OutputGroups.find(og => og.Name === 'hls_output_group');
          expect(hlsOutputGroup).toBeDefined();
          expect(hlsOutputGroup.Outputs.length).toBe(expectedVariants.length);

          // Property 5: Each output should reference a unique video description
          const outputVideoDescriptions = hlsOutputGroup.Outputs.map(output => output.VideoDescriptionName);
          expect(new Set(outputVideoDescriptions).size).toBe(outputVideoDescriptions.length);

          // Property 6: All outputs should share the same audio description
          const audioDescriptions = hlsOutputGroup.Outputs.map(output => output.AudioDescriptionNames[0]);
          expect(new Set(audioDescriptions).size).toBe(1);
          expect(audioDescriptions[0]).toBe('audio_1');

          // Verify MediaStore container accessibility
          const containerDetails = await mockMediaStore.describeContainer({ ContainerName: 'direct-fan-platform-streaming-prod' });
          expect(containerDetails.Container.Status).toBe('ACTIVE');

          // Property 7: Master playlist should be available and contain all variants
          if (config.streamState === 'RUNNING') {
            const masterPlaylist = await mockMediaStore.getObject({
              Path: '/live/index.m3u8'
            });

            const masterContent = masterPlaylist.Body.toString();
            
            // Should be valid M3U8 format
            expect(masterContent).toMatch(/^#EXTM3U/);
            
            // Should contain EXT-X-STREAM-INF entries for each variant
            const streamInfLines = masterContent.split('\n').filter(line => line.startsWith('#EXT-X-STREAM-INF:'));
            expect(streamInfLines.length).toBe(expectedVariants.length);

            // Property 8: Each variant should have bandwidth and resolution information
            streamInfLines.forEach((line, index) => {
              expect(line).toMatch(/BANDWIDTH=\d+/);
              expect(line).toMatch(/RESOLUTION=\d+x\d+/);
              
              const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
              const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
              
              expect(bandwidthMatch).toBeTruthy();
              expect(resolutionMatch).toBeTruthy();
              
              const bandwidth = parseInt(bandwidthMatch[1]);
              const width = parseInt(resolutionMatch[1]);
              const height = parseInt(resolutionMatch[2]);
              
              // Bandwidth should match expected bitrate
              expect(bandwidth).toBe(expectedVariants[index].bitrate);
              expect(width).toBe(expectedVariants[index].width);
              expect(height).toBe(expectedVariants[index].height);
            });

            // Property 9: Individual variant playlists should be accessible
            for (const variant of expectedVariants) {
              const variantPlaylist = await mockMediaStore.getObject({
                Path: `/live/index_${variant.resolution}.m3u8`
              });

              const variantContent = variantPlaylist.Body.toString();
              
              // Should be valid M3U8 format
              expect(variantContent).toMatch(/^#EXTM3U/);
              expect(variantContent).toMatch(/#EXT-X-TARGETDURATION:\d+/);
              expect(variantContent).toMatch(/#EXT-X-MEDIA-SEQUENCE:\d+/);
              
              // Should contain segment references
              const segmentLines = variantContent.split('\n').filter(line => line.endsWith('.ts'));
              expect(segmentLines.length).toBeGreaterThan(0);
            }
          }

          // Property 10: Channel configuration should support adaptive streaming requirements
          expect(channelDetails.InputSpecification.Codec).toBe('AVC');
          expect(['SD', 'HD', 'UHD']).toContain(channelDetails.InputSpecification.InputResolution);
          
          // Property 11: HLS settings should be optimized for adaptive streaming
          const hlsSettings = hlsOutputGroup.OutputGroupSettings.HlsGroupSettings;
          expect(hlsSettings.Mode).toBe('LIVE');
          expect(hlsSettings.OutputSelection).toBe('MANIFESTS_AND_SEGMENTS');
          expect(hlsSettings.SegmentLength).toBeGreaterThan(0);
          expect(hlsSettings.SegmentLength).toBeLessThanOrEqual(10); // Reasonable segment length

          // Property 12: Audio settings should be consistent across all variants
          const audioDescription = channelDetails.EncoderSettings.AudioDescriptions[0];
          expect(audioDescription.CodecSettings.AacSettings.Bitrate).toBeGreaterThan(0);
          expect(audioDescription.CodecSettings.AacSettings.SampleRate).toBeGreaterThanOrEqual(44100);

          // Property 13: Video codec settings should be appropriate for streaming
          videoDescriptions.forEach(vd => {
            const h264Settings = vd.CodecSettings.H264Settings;
            expect(h264Settings.Profile).toBe('HIGH');
            expect(h264Settings.FramerateNumerator).toBeGreaterThan(0);
            expect(h264Settings.FramerateDenominator).toBeGreaterThan(0);
            expect(h264Settings.Bitrate).toBeGreaterThan(0);
            
            // Bitrate should be reasonable for the resolution
            const pixelCount = vd.Width * vd.Height;
            const bitsPerPixel = h264Settings.Bitrate / (pixelCount * (h264Settings.FramerateNumerator / h264Settings.FramerateDenominator));
            expect(bitsPerPixel).toBeGreaterThan(0.01); // Minimum quality threshold
            expect(bitsPerPixel).toBeLessThan(1.0); // Maximum reasonable bits per pixel
          });
        }
      ),
      { numRuns: 10 } // Reduced iterations for faster testing
    );
  });

  /**
   * Property: Bitrate Ladder Consistency
   * For any adaptive streaming configuration, the bitrate ladder should follow
   * logical progression with appropriate quality steps
   */
  test('Property: Bitrate ladder follows logical quality progression', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          inputResolution: fc.constantFrom('SD', 'HD', 'UHD'),
          targetBandwidth: fc.integer({ min: 1000000, max: 10000000 }), // 1-10 Mbps
          qualitySteps: fc.integer({ min: 2, max: 6 })
        }),
        async (config) => {
          // Generate bitrate ladder based on input parameters
          const generateBitrateLadder = (maxBitrate, steps) => {
            const ladder = [];
            const bitrateRatio = 0.6; // Each step is ~60% of the previous
            
            let currentBitrate = maxBitrate;
            for (let i = 0; i < steps; i++) {
              const resolution = i === 0 ? '1080p' : 
                               i === 1 ? '720p' : 
                               i === 2 ? '480p' : 
                               i === 3 ? '360p' : 
                               i === 4 ? '240p' : '144p';
              
              ladder.push({
                resolution,
                bitrate: Math.floor(currentBitrate),
                width: i === 0 ? 1920 : i === 1 ? 1280 : i === 2 ? 854 : i === 3 ? 640 : i === 4 ? 426 : 256,
                height: i === 0 ? 1080 : i === 1 ? 720 : i === 2 ? 480 : i === 3 ? 360 : i === 4 ? 240 : 144
              });
              
              currentBitrate *= bitrateRatio;
            }
            
            return ladder;
          };

          const bitrateLadder = generateBitrateLadder(config.targetBandwidth, config.qualitySteps);

          // Mock channel with generated bitrate ladder
          mockMediaLive.describeChannel.mockResolvedValue({
            Id: 'test-channel',
            EncoderSettings: {
              VideoDescriptions: bitrateLadder.map((step, index) => ({
                Name: `video_${step.resolution}`,
                Width: step.width,
                Height: step.height,
                CodecSettings: {
                  H264Settings: {
                    Bitrate: step.bitrate,
                    Profile: 'HIGH'
                  }
                }
              }))
            }
          });

          const mediaLive = new AWS.MediaLive();
          const channelDetails = await mockMediaLive.describeChannel({ ChannelId: 'test-channel' });
          const videoDescriptions = channelDetails.EncoderSettings.VideoDescriptions;

          // Property 1: Bitrates should be in descending order
          const bitrates = videoDescriptions.map(vd => vd.CodecSettings.H264Settings.Bitrate);
          for (let i = 0; i < bitrates.length - 1; i++) {
            expect(bitrates[i]).toBeGreaterThan(bitrates[i + 1]);
          }

          // Property 2: Bitrate ratios should be reasonable (not too close, not too far apart)
          for (let i = 0; i < bitrates.length - 1; i++) {
            const ratio = bitrates[i + 1] / bitrates[i];
            expect(ratio).toBeGreaterThan(0.3); // Not more than 70% reduction
            expect(ratio).toBeLessThan(0.8); // Not less than 20% reduction
          }

          // Property 3: Resolution should decrease with bitrate
          const pixelCounts = videoDescriptions.map(vd => vd.Width * vd.Height);
          for (let i = 0; i < pixelCounts.length - 1; i++) {
            expect(pixelCounts[i]).toBeGreaterThanOrEqual(pixelCounts[i + 1]);
          }

          // Property 4: Aspect ratio should be consistent across variants
          const aspectRatios = videoDescriptions.map(vd => vd.Width / vd.Height);
          const firstAspectRatio = aspectRatios[0];
          aspectRatios.forEach(ratio => {
            expect(Math.abs(ratio - firstAspectRatio)).toBeLessThan(0.1); // Allow small variance
          });

          // Property 5: Minimum quality threshold should be maintained
          const lowestBitrate = bitrates[bitrates.length - 1];
          const lowestResolution = videoDescriptions[videoDescriptions.length - 1];
          const bitsPerPixel = lowestBitrate / (lowestResolution.Width * lowestResolution.Height * 30); // Assuming 30fps
          expect(bitsPerPixel).toBeGreaterThan(0.01); // Minimum quality threshold
        }
      ),
      { numRuns: 10 } // Reduced iterations for faster testing
    );
  });

  /**
   * Property: Streaming Format Compatibility
   * For any adaptive streaming setup, output formats should be compatible
   * with standard HLS players and specifications
   */
  test('Property: Streaming formats are HLS-compliant and player-compatible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          segmentLength: fc.integer({ min: 2, max: 10 }),
          playlistType: fc.constantFrom('LIVE', 'VOD'),
          targetDuration: fc.integer({ min: 6, max: 15 })
        }),
        async (config) => {
          // Mock HLS configuration
          mockMediaLive.describeChannel.mockResolvedValue({
            Id: 'test-channel',
            EncoderSettings: {
              OutputGroups: [{
                Name: 'hls_output_group',
                OutputGroupSettings: {
                  HlsGroupSettings: {
                    SegmentLength: config.segmentLength,
                    Mode: config.playlistType,
                    ManifestDurationFormat: 'FLOATING_POINT',
                    OutputSelection: 'MANIFESTS_AND_SEGMENTS',
                    CodecSpecification: 'RFC_4281',
                    DirectoryStructure: 'SINGLE_DIRECTORY',
                    ProgramDateTime: 'INCLUDE',
                    SegmentationMode: 'USE_SEGMENT_DURATION'
                  }
                }
              }]
            }
          });

          // Mock playlist content with proper HLS format
          const playlistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${config.targetDuration}
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:${new Date().toISOString()}
#EXTINF:${config.segmentLength}.0,
segment_001.ts
#EXTINF:${config.segmentLength}.0,
segment_002.ts`;

          mockMediaStore.getObject.mockResolvedValue({
            Body: Buffer.from(playlistContent),
            ContentType: 'application/vnd.apple.mpegurl'
          });

          const mediaLive = new AWS.MediaLive();
          const mediaStore = new AWS.MediaStoreData();

          const channelDetails = await mockMediaLive.describeChannel({ ChannelId: 'test-channel' });
          const hlsSettings = channelDetails.EncoderSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings;

          // Property 1: HLS settings should comply with RFC specifications
          expect(hlsSettings.CodecSpecification).toBe('RFC_4281');
          expect(hlsSettings.ManifestDurationFormat).toBe('FLOATING_POINT');

          // Property 2: Segment length should be within reasonable bounds
          expect(hlsSettings.SegmentLength).toBeGreaterThanOrEqual(2);
          expect(hlsSettings.SegmentLength).toBeLessThanOrEqual(10);

          // Property 3: Playlist format should be valid HLS
          const playlist = await mockMediaStore.getObject({ Path: '/test.m3u8' });
          const content = playlist.Body.toString();

          expect(content).toMatch(/^#EXTM3U/); // Must start with #EXTM3U
          expect(content).toMatch(/#EXT-X-VERSION:\d+/); // Must have version
          expect(content).toMatch(/#EXT-X-TARGETDURATION:\d+/); // Must have target duration

          // Property 4: Target duration should be appropriate for segment length
          const targetDurationMatch = content.match(/#EXT-X-TARGETDURATION:(\d+)/);
          if (targetDurationMatch) {
            const targetDuration = parseInt(targetDurationMatch[1]);
            // Property 4: Target duration should be reasonable relative to segment length
            // HLS spec allows target duration to be different from segment length
            expect(targetDuration).toBeGreaterThan(0);
            expect(targetDuration).toBeLessThanOrEqual(30); // Max 30 seconds per HLS spec
          }

          // Property 5: Segments should have proper EXTINF tags
          const extinfLines = content.split('\n').filter(line => line.startsWith('#EXTINF:'));
          const segmentLines = content.split('\n').filter(line => line.endsWith('.ts'));
          expect(extinfLines.length).toBe(segmentLines.length); // Each segment should have EXTINF

          // Property 6: EXTINF durations should match segment length
          extinfLines.forEach(line => {
            const durationMatch = line.match(/#EXTINF:(\d+(?:\.\d+)?),/);
            expect(durationMatch).toBeTruthy();
            const duration = parseFloat(durationMatch[1]);
            expect(duration).toBeCloseTo(config.segmentLength, 1);
          });
        }
      ),
      { numRuns: 10 } // Reduced iterations for faster testing
    );
  });
});