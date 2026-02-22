import { put, del, list } from '@vercel/blob';

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

export interface UploadResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

/**
 * Upload a file to Vercel Blob storage and return a client upload URL.
 */
export async function generatePresignedUrl({
  fileName,
  fileType,
  fileSize,
  artistId,
}: UploadRequest): Promise<UploadResponse> {
  // Validate file type
  if (!SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES]) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];

  // Validate file size
  if (fileSize > FILE_SIZE_LIMITS[fileInfo.category]) {
    const limitMB = FILE_SIZE_LIMITS[fileInfo.category] / (1024 * 1024);
    throw new Error(`File size exceeds limit of ${limitMB}MB for ${fileInfo.category} files`);
  }

  // Generate unique path
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `content/${artistId}/${timestamp}-${sanitizedFileName}`;

  // For Vercel Blob, we return a placeholder upload URL.
  // Actual uploads should use the `put()` function server-side
  // or `upload()` from @vercel/blob/client on the client side.
  return {
    uploadUrl: key,
    fileUrl: key,
    key,
  };
}

/**
 * Upload a buffer directly to Vercel Blob storage.
 */
export async function uploadFile(
  key: string,
  data: Buffer | ReadableStream | Blob,
  contentType: string
): Promise<string> {
  const blob = await put(key, data, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

/**
 * Delete a file from Vercel Blob storage.
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url);
}

/**
 * Extract the pathname from a Vercel Blob URL.
 */
export function extractKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.slice(1); // remove leading /
  } catch {
    return url;
  }
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
