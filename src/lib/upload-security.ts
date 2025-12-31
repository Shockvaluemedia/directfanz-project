import { authSecurity } from './auth-security';

interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
}

export class FileUploadSecurity {
  private static readonly ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    document: ['application/pdf', 'text/plain'],
  };

  private static readonly MAX_FILE_SIZES = {
    image: 10 * 1024 * 1024, // 10MB
    video: 500 * 1024 * 1024, // 500MB
    document: 5 * 1024 * 1024, // 5MB
  };

  static validateFile(file: File, category: keyof typeof this.ALLOWED_TYPES): FileValidationResult {
    const errors: string[] = [];

    // Check file type
    const allowedTypes = this.ALLOWED_TYPES[category];
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not allowed for ${category}`);
    }

    // Check file size
    const maxSize = this.MAX_FILE_SIZES[category];
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${maxSize} bytes`);
    }

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(file.name);
    if (!sanitizedFilename) {
      errors.push('Invalid filename');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedFilename,
    };
  }

  private static sanitizeFilename(filename: string): string {
    // Remove dangerous characters and limit length
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 100)
      .toLowerCase();
  }

  static async scanForMalware(fileBuffer: Buffer): Promise<boolean> {
    // In production, integrate with malware scanning service
    // For now, basic checks
    const suspiciousPatterns = [
      /\x4D\x5A/, // PE executable header
      /<script/i, // Script tags
      /javascript:/i, // JavaScript protocol
    ];

    const fileContent = fileBuffer.toString('binary');
    return !suspiciousPatterns.some(pattern => pattern.test(fileContent));
  }
}

export class APIRateLimiter {
  static async checkAPIRateLimit(
    identifier: string,
    endpoint: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const rateLimitKey = `${identifier}:${endpoint}`;
    
    // Different limits for different endpoints
    const endpointLimits = {
      '/api/upload': { windowMs: 60000, maxAttempts: 10, blockDurationMs: 300000 },
      '/api/content': { windowMs: 60000, maxAttempts: 50, blockDurationMs: 60000 },
      '/api/auth': { windowMs: 900000, maxAttempts: 5, blockDurationMs: 1800000 },
      default: { windowMs: 60000, maxAttempts: 100, blockDurationMs: 300000 },
    };

    const config = endpointLimits[endpoint as keyof typeof endpointLimits] || endpointLimits.default;
    
    return await authSecurity.checkRateLimit(rateLimitKey, config);
  }

  static async checkIPRateLimit(ipAddress: string): Promise<boolean> {
    const result = await authSecurity.checkRateLimit(
      `ip:${ipAddress}`,
      { windowMs: 60000, maxAttempts: 1000, blockDurationMs: 300000 }
    );
    
    return result.allowed;
  }

  static async detectAbusePattern(userId: string, action: string): Promise<boolean> {
    // Track user actions for abuse detection
    const patterns = {
      rapid_uploads: { windowMs: 300000, maxAttempts: 20 }, // 20 uploads in 5 minutes
      rapid_requests: { windowMs: 60000, maxAttempts: 200 }, // 200 requests per minute
    };

    const pattern = patterns[action as keyof typeof patterns];
    if (!pattern) return false;

    const result = await authSecurity.checkRateLimit(
      `abuse:${userId}:${action}`,
      { ...pattern, blockDurationMs: 3600000 } // 1 hour block
    );

    return !result.allowed;
  }
}

export const fileUploadSecurity = FileUploadSecurity;
export const apiRateLimiter = APIRateLimiter;