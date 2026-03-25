// Mock AWS S3 storage layer
jest.mock('@/lib/s3', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://mock-s3.amazonaws.com/test-file'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  headFile: jest.fn().mockResolvedValue({
    url: 'https://mock-s3.amazonaws.com/test-file',
    size: 12345,
    uploadedAt: new Date(),
    contentType: 'image/jpeg',
  }),
  extractKeyFromUrl: jest.fn(url => url),
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
    audioCodec: jest.fn().mockReturnThis(),
    videoCodec: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    run: jest.fn(),
    save: jest.fn(),
  }));
  mockFfmpeg.setFfmpegPath = jest.fn();
  mockFfmpeg.setFfprobePath = jest.fn();
  return mockFfmpeg;
});

jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg');
jest.mock('ffprobe-static', () => ({ path: '/usr/bin/ffprobe' }));
