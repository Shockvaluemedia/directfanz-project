import { validateFile, formatFileSize, getPresignedUrl } from '../upload-utils';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Upload Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should accept valid image files', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB
      
      const errors = validateFile(file);
      expect(errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const file = new File([''], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 600 * 1024 * 1024 }); // 600MB
      
      const errors = validateFile(file);
      expect(errors).toContain('File size must be less than 500MB');
    });

    it('should reject empty files', () => {
      const file = new File([''], 'empty.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 0 });
      
      const errors = validateFile(file);
      expect(errors).toContain('File cannot be empty');
    });

    it('should reject unsupported file types', () => {
      const file = new File([''], 'test.exe', { type: 'application/exe' });
      Object.defineProperty(file, 'size', { value: 1024 });
      
      const errors = validateFile(file);
      expect(errors).toContain('File type application/exe is not allowed');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0.0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB'); // 1.5KB
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('getPresignedUrl', () => {
    it('should make correct API request', async () => {
      const mockResponse = {
        success: true,
        data: {
          uploadUrl: 'https://example.com/upload',
          fileUrl: 'https://example.com/file.jpg',
          key: 'uploads/test.jpg',
          useLocalStorage: false,
        },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const config = {
        fileName: 'test.jpg',
        fileType: 'image/jpeg', 
        fileSize: 1024,
      };

      const result = await getPresignedUrl(config);

      expect(fetch).toHaveBeenCalledWith('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should throw error for failed requests', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid request' }),
      });

      const config = {
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
      };

      await expect(getPresignedUrl(config)).rejects.toThrow('Invalid request');
    });
  });
});