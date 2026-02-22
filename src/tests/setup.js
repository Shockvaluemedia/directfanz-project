// Mock Vercel Blob storage
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({
    url: 'https://mock-blob.vercel-storage.com/test-file',
    pathname: 'test-file',
    contentType: 'image/jpeg',
  }),
  del: jest.fn().mockResolvedValue(undefined),
  head: jest.fn().mockResolvedValue({
    url: 'https://mock-blob.vercel-storage.com/test-file',
    size: 12345,
    uploadedAt: new Date(),
    contentType: 'image/jpeg',
  }),
  list: jest.fn().mockResolvedValue({
    blobs: [],
    cursor: undefined,
    hasMore: false,
  }),
}));

// Mock FFmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn().mockImplementation(() => ({
    setFfmpegPath: jest.fn(),
    setFfprobePath: jest.fn(),
    input: jest.fn().mockReturnThis(),
    inputFormat: jest.fn().mockReturnThis(),
    outputFormat: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    videoCodec: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    videoBitrate: jest.fn().mockReturnThis(),
    fps: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    addOption: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    noAudio: jest.fn().mockReturnThis(),
    noVideo: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, cb) => {
      if (event === 'end') {
        setTimeout(() => cb(), 10);
      }
      return mockFfmpeg();
    }),
    run: jest.fn().mockImplementation(cb => {
      setTimeout(() => cb(), 10);
      return mockFfmpeg();
    }),
    save: jest.fn().mockImplementation((path, cb) => {
      setTimeout(() => cb(), 10);
      return mockFfmpeg();
    }),
    screenshots: jest.fn().mockImplementation(options => {
      if (options.count && options.folder) {
        setTimeout(() => options.filename ? options.filename('thumbnail.jpg') : null, 10);
      }
      return mockFfmpeg();
    }),
    ffprobe: jest.fn().mockImplementation((path, cb) => {
      cb(null, {
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            duration: 60,
            bit_rate: 5000000,
            r_frame_rate: '30/1'
          },
          {
            codec_type: 'audio',
            duration: 60,
            bit_rate: 128000,
            sample_rate: 44100,
            channels: 2
          }
        ],
        format: {
          duration: 60,
          size: 5000000,
          bit_rate: 6000000
        }
      });
      return mockFfmpeg();
    })
  }));

  return mockFfmpeg;
});

jest.mock('ffmpeg-static', () => 'mocked-ffmpeg-path');
jest.mock('ffprobe-static', () => ({
  path: 'mocked-ffprobe-path'
}));

// Mock Sharp image processing
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 1024 * 1024,
      channels: 3
    }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({ size: 512 * 1024 }),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked-image-data'))
  }));
});

// Mock NextAuth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: '123', role: 'ARTIST' }
  })
}));