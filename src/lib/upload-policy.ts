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

/**
 * What an upload is for decides where it is stored and who may read it:
 * - content: an artist's paid or gated media (private, behind content access)
 * - image: avatars, covers, banners and thumbnails (readable by anyone)
 * - submission: a fan's challenge or campaign entry (readable by anyone)
 * - attachment: a direct-message attachment (only that conversation)
 */
export const UPLOAD_PURPOSES = {
  content: { area: 'content', categories: ['AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT'], artistOnly: true },
  image: { area: 'public', categories: ['IMAGE'], artistOnly: false },
  submission: { area: 'public', categories: ['AUDIO', 'VIDEO', 'IMAGE'], artistOnly: false },
  attachment: { area: 'private', categories: ['IMAGE', 'AUDIO'], artistOnly: false },
} as const;

export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPLOAD_PURPOSES, value);
}

/** True when files of this type may be uploaded for this purpose. */
export function purposeAllowsType(purpose: UploadPurpose, fileType: string): boolean {
  const info = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];
  return Boolean(info) && (UPLOAD_PURPOSES[purpose].categories as readonly string[]).includes(info.category);
}

export interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  /** The uploading user (an artist for content uploads). */
  artistId: string;
  /** Defaults to content. */
  purpose?: UploadPurpose;
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
  /**
   * What to save once the upload is confirmed: an s3:// reference for content
   * files, or an /api/media/ path for files the browser loads directly.
   */
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
