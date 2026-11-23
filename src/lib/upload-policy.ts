/**
 * Which files artists may upload and how large they may be. Client-safe: no
 * storage SDK here, so upload components can share the same rules.
 */

// Supported file types and their MIME types
export const SUPPORTED_FILE_TYPES = {
  // Audio
  'audio/mpeg': { extension: 'mp3', category: 'AUDIO' },
  'audio/wav': { extension: 'wav', category: 'AUDIO' },
  'audio/flac': { extension: 'flac', category: 'AUDIO' },
  'audio/aac': { extension: 'aac', category: 'AUDIO' },

  // Video
  'video/mp4': { extension: 'mp4', category: 'VIDEO' },
  'video/webm': { extension: 'webm', category: 'VIDEO' },
  'video/quicktime': { extension: 'mov', category: 'VIDEO' },

  // Images
  'image/jpeg': { extension: 'jpg', category: 'IMAGE' },
  'image/png': { extension: 'png', category: 'IMAGE' },
  'image/webp': { extension: 'webp', category: 'IMAGE' },
  'image/gif': { extension: 'gif', category: 'IMAGE' },

  // Documents
  'application/pdf': { extension: 'pdf', category: 'DOCUMENT' },
  'text/plain': { extension: 'txt', category: 'DOCUMENT' },
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AUDIO: 100 * 1024 * 1024, // 100MB
  VIDEO: 500 * 1024 * 1024, // 500MB
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
} as const;

export interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  artistId: string;
}

/** Large files go up in parts straight to storage, never through the app. */
export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
export const MULTIPART_PART_BYTES = 16 * 1024 * 1024;

export interface MultipartUploadPlan {
  uploadId: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}

export interface UploadResponse {
  /** Single-PUT link; empty when the upload is multipart. */
  uploadUrl: string;
  /** Storage reference to save on the content row once the upload is confirmed. */
  fileUrl: string;
  key: string;
  /** Exact Content-Type the PUT must send (it is part of the signature). */
  contentType?: string;
  multipart?: MultipartUploadPlan;
  useLocalStorage?: boolean;
}

/**
 * Validate file upload parameters.
 */
export function validateFileUpload(fileName: string, fileType: string, fileSize: number) {
  const errors: string[] = [];

  if (!SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES]) {
    errors.push(`Unsupported file type: ${fileType}`);
  } else {
    const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];
    if (fileSize > FILE_SIZE_LIMITS[fileInfo.category]) {
      const limitMB = FILE_SIZE_LIMITS[fileInfo.category] / (1024 * 1024);
      errors.push(`File size exceeds limit of ${limitMB}MB for ${fileInfo.category} files`);
    }
  }

  if (!fileName || fileName.trim().length === 0) {
    errors.push('File name is required');
  }

  if (fileSize <= 0) {
    errors.push('File size must be greater than 0');
  }

  return errors;
}
