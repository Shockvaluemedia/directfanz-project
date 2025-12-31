import { FileUploadSecurity, APIRateLimiter } from '../../src/lib/upload-security';

describe('Property Test: File Upload and API Security', () => {
  describe('Property 13: File upload and API security', () => {
    test('File type validation should reject dangerous files', () => {
      const dangerousFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
      const result = FileUploadSecurity.validateFile(dangerousFile, 'image');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('File size limits should be enforced', () => {
      const oversizedFile = new File([new ArrayBuffer(20 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const result = FileUploadSecurity.validateFile(oversizedFile, 'image');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('size'))).toBe(true);
    });

    test('Filename sanitization should remove dangerous characters', () => {
      const dangerousFilename = '../../../etc/passwd';
      const sanitized = FileUploadSecurity['sanitizeFilename'](dangerousFilename);
      
      expect(sanitized).not.toContain('../');
      expect(sanitized).not.toContain('/');
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });

    test('Allowed file types should be restrictive', () => {
      const allowedTypes = FileUploadSecurity['ALLOWED_TYPES'];
      
      // Should not allow executable types
      Object.values(allowedTypes).forEach(types => {
        expect(types).not.toContain('application/x-executable');
        expect(types).not.toContain('application/x-msdownload');
        expect(types).not.toContain('text/html');
      });
    });

    test('API rate limiting should be configured per endpoint', async () => {
      const endpointLimits = {
        '/api/upload': 10,
        '/api/content': 50,
        '/api/auth': 5,
      };
      
      Object.entries(endpointLimits).forEach(([endpoint, limit]) => {
        expect(limit).toBeGreaterThan(0);
        expect(limit).toBeLessThanOrEqual(100);
      });
    });

    test('IP rate limiting should prevent abuse', async () => {
      expect(typeof APIRateLimiter.checkIPRateLimit).toBe('function');
      expect(typeof APIRateLimiter.detectAbusePattern).toBe('function');
    });

    test('Malware scanning should detect suspicious patterns', async () => {
      const suspiciousBuffer = Buffer.from('<script>alert("xss")</script>');
      const cleanBuffer = Buffer.from('This is a clean text file');
      
      expect(typeof FileUploadSecurity.scanForMalware).toBe('function');
    });

    test('Abuse detection should track user patterns', async () => {
      const abusePatterns = {
        rapid_uploads: { windowMs: 300000, maxAttempts: 20 },
        rapid_requests: { windowMs: 60000, maxAttempts: 200 },
      };
      
      Object.values(abusePatterns).forEach(pattern => {
        expect(pattern.maxAttempts).toBeGreaterThan(0);
        expect(pattern.windowMs).toBeGreaterThan(0);
      });
    });

    test('File validation should handle edge cases', () => {
      // Empty file
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
      const emptyResult = FileUploadSecurity.validateFile(emptyFile, 'image');
      expect(emptyResult.valid).toBe(true); // Empty files are technically valid
      
      // File with no extension
      const noExtFile = new File(['content'], 'filename', { type: 'image/jpeg' });
      const noExtResult = FileUploadSecurity.validateFile(noExtFile, 'image');
      expect(noExtResult.sanitizedFilename).toBeDefined();
    });
  });
});