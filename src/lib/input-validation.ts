import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { logger } from './logger';

// File validation constants
export const ALLOWED_FILE_TYPES = {
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  DOCUMENT: ['application/pdf', 'text/plain'],
} as const;

export const MAX_FILE_SIZES = {
  AUDIO: 100 * 1024 * 1024, // 100MB
  VIDEO: 500 * 1024 * 1024, // 500MB
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
} as const;

// Suspicious patterns that could indicate malicious content
const SUSPICIOUS_PATTERNS = [
  /javascript:/i,
  /<script/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
  /vbscript:/i,
  /expression\s*\(/i,
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.scr$/i,
  /\.vbs$/i,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
  /(\binsert\b.*\binto\b)|(\bdelete\b.*\bfrom\b)/i,
  /(\bdrop\b.*\btable\b)|(\bcreate\b.*\btable\b)/i,
  /(\bexec\b.*\bsp_)/i,
  /(;\s*(drop|insert|delete|update|create))/i,
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface FileValidationResult extends ValidationResult {
  fileType?: string;
  fileSize?: number;
  fileName?: string;
}

/**
 * Comprehensive text input validation and sanitization
 */
export function validateAndSanitizeText(
  input: string,
  options: {
    maxLength?: number;
    minLength?: number;
    allowHtml?: boolean;
    stripTags?: boolean;
    checkSql?: boolean;
    checkXss?: boolean;
  } = {}
): ValidationResult {
  const {
    maxLength = 10000,
    minLength = 0,
    allowHtml = false,
    stripTags = true,
    checkSql = true,
    checkXss = true,
  } = options;

  const errors: string[] = [];
  let sanitizedValue = input;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Basic length validation
  if (input.length < minLength) {
    errors.push(`Input must be at least ${minLength} characters long`);
  }

  if (input.length > maxLength) {
    errors.push(`Input must not exceed ${maxLength} characters`);
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially malicious content');
      riskLevel = 'high';
      break;
    }
  }

  // SQL injection detection
  if (checkSql) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        errors.push('Input contains potential SQL injection attempt');
        riskLevel = 'high';
        break;
      }
    }
  }

  // XSS detection and sanitization
  if (checkXss) {
    if (allowHtml) {
      // Sanitize HTML while preserving safe tags
      sanitizedValue = DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: [],
      });
    } else if (stripTags) {
      // Strip all HTML tags
      sanitizedValue = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    }

    // Check if content was modified during sanitization
    if (sanitizedValue !== input && riskLevel === 'low') {
      riskLevel = 'medium';
    }
  }

  // Additional validations
  if (validator.contains(input, '\0')) {
    errors.push('Input contains null bytes');
    riskLevel = 'high';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue,
    riskLevel,
  };
}

/**
 * Email validation with advanced security checks
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!validator.isEmail(email)) {
    errors.push('Invalid email format');
  }

  // Check for suspicious email patterns
  if (email.includes('..') || email.includes('--')) {
    errors.push('Email contains suspicious patterns');
  }

  // Normalize email
  const normalizedEmail = validator.normalizeEmail(email);

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: normalizedEmail || email,
  };
}

/**
 * Advanced file validation with security checks
 */
export function validateFile(
  fileName: string,
  mimeType: string,
  fileSize: number,
  fileBuffer?: Buffer
): FileValidationResult {
  const errors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  // Check file extension matches MIME type
  const fileExtension = fileName.toLowerCase().split('.').pop();
  const allowedTypes = Object.values(ALLOWED_FILE_TYPES).flat() as string[];

  if (!allowedTypes.includes(mimeType)) {
    errors.push(`File type ${mimeType} is not allowed`);
    riskLevel = 'high';
  }

  // Determine file category and check size limits
  let fileCategory: keyof typeof MAX_FILE_SIZES | null = null;
  for (const [category, types] of Object.entries(ALLOWED_FILE_TYPES)) {
    if ((types as unknown as string[]).includes(mimeType)) {
      fileCategory = category as keyof typeof MAX_FILE_SIZES;
      break;
    }
  }

  if (fileCategory && fileSize > MAX_FILE_SIZES[fileCategory]) {
    errors.push(`File size exceeds limit for ${fileCategory} files`);
    riskLevel = 'high';
  }

  // Check for suspicious file names
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'];
  if (suspiciousExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
    errors.push('File type is potentially dangerous');
    riskLevel = 'high';
  }

  // Advanced: Check file magic numbers if buffer provided
  if (fileBuffer) {
    const magicNumber = fileBuffer.slice(0, 4).toString('hex');
    const isValidMagicNumber = checkFileMagicNumber(magicNumber, mimeType);

    if (!isValidMagicNumber) {
      errors.push('File content does not match declared type');
      riskLevel = 'high';
    }
  }

  // Check filename for path traversal attempts
  if (fileName.includes('../') || fileName.includes('..\\')) {
    errors.push('Filename contains path traversal attempt');
    riskLevel = 'high';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedFileName,
    fileType: mimeType,
    fileSize,
    fileName: sanitizedFileName,
    riskLevel,
  };
}

/**
 * Check if file magic number matches declared MIME type
 */
function checkFileMagicNumber(magicNumber: string, mimeType: string): boolean {
  const magicNumbers: Record<string, string[]> = {
    'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
    'image/png': ['89504e47'],
    'image/gif': ['47494638'],
    'image/webp': ['52494646'],
    'video/mp4': ['66747970'],
    'audio/mpeg': ['494433'],
    'application/pdf': ['25504446'],
  };

  const expectedMagic = magicNumbers[mimeType];
  if (!expectedMagic) return true; // Unknown type, allow

  return expectedMagic.some(magic => magicNumber.toLowerCase().startsWith(magic));
}

/**
 * Validate JSON input with size and structure limits
 */
export function validateJson(
  input: string,
  options: {
    maxSize?: number;
    allowedKeys?: string[];
    maxDepth?: number;
  } = {}
): ValidationResult {
  const { maxSize = 1024 * 1024, allowedKeys, maxDepth = 10 } = options;
  const errors: string[] = [];

  if (input.length > maxSize) {
    errors.push(`JSON input exceeds maximum size of ${maxSize} bytes`);
  }

  try {
    const parsed = JSON.parse(input);

    // Check depth
    if (getObjectDepth(parsed) > maxDepth) {
      errors.push(`JSON object exceeds maximum depth of ${maxDepth}`);
    }

    // Check allowed keys if specified
    if (allowedKeys && typeof parsed === 'object') {
      const invalidKeys = Object.keys(parsed).filter(key => !allowedKeys.includes(key));
      if (invalidKeys.length > 0) {
        errors.push(`JSON contains disallowed keys: ${invalidKeys.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: parsed,
    };
  } catch (error) {
    errors.push('Invalid JSON format');
    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Calculate object depth for JSON validation
 */
function getObjectDepth(obj: any): number {
  if (obj === null || typeof obj !== 'object') return 1;

  const depths = Object.values(obj).map(value => getObjectDepth(value));
  return 1 + Math.max(...depths, 0);
}

/**
 * Comprehensive API request validation
 */
export function validateApiRequest(
  body: any,
  schema: z.ZodSchema,
  options: {
    maxBodySize?: number;
    checkInjection?: boolean;
    sanitizeStrings?: boolean;
  } = {}
): ValidationResult {
  const { maxBodySize = 1024 * 1024, checkInjection = true, sanitizeStrings = true } = options;
  const errors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  try {
    // Size check
    const bodySize = JSON.stringify(body).length;
    if (bodySize > maxBodySize) {
      errors.push(`Request body exceeds maximum size of ${maxBodySize} bytes`);
    }

    // Schema validation
    const schemaResult = schema.safeParse(body);
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach(err => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    }

    let sanitizedBody = body;

    // Sanitize string values if requested
    if (sanitizeStrings && typeof body === 'object') {
      sanitizedBody = sanitizeObjectStrings(body, checkInjection);
      if (JSON.stringify(sanitizedBody) !== JSON.stringify(body)) {
        riskLevel = 'medium';
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: schemaResult.success ? sanitizedBody : undefined,
      riskLevel,
    };
  } catch (error) {
    errors.push('Invalid request format');
    return {
      isValid: false,
      errors,
      riskLevel: 'high',
    };
  }
}

/**
 * Recursively sanitize string values in an object
 */
function sanitizeObjectStrings(obj: any, checkInjection = true): any {
  if (typeof obj === 'string') {
    const result = validateAndSanitizeText(obj, {
      checkSql: checkInjection,
      checkXss: true,
    });
    return result.sanitizedValue || obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectStrings(item, checkInjection));
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObjectStrings(value, checkInjection);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Log security events for monitoring
 */
export function logSecurityEvent(
  eventType: string,
  riskLevel: 'low' | 'medium' | 'high',
  details: Record<string, any>
) {
  logger.securityEvent(`Input validation: ${eventType}`, riskLevel, {
    ...details,
    timestamp: new Date().toISOString(),
  });
}
