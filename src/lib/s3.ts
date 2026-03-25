import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME || '';

const s3 = new S3Client({ region: REGION });

function publicUrl(key: string): string {
  const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (cdnDomain) {
    return `https://${cdnDomain}/${key}`;
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

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
 * Generate a presigned-style upload response (server-side upload path).
 */
export async function generatePresignedUrl({
  fileName,
  fileType,
  fileSize,
  artistId,
}: UploadRequest): Promise<UploadResponse> {
  if (!SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES]) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];

  if (fileSize > FILE_SIZE_LIMITS[fileInfo.category]) {
    const limitMB = FILE_SIZE_LIMITS[fileInfo.category] / (1024 * 1024);
    throw new Error(`File size exceeds limit of ${limitMB}MB for ${fileInfo.category} files`);
  }

  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `content/${artistId}/${timestamp}-${sanitizedFileName}`;

  return {
    uploadUrl: key,
    fileUrl: publicUrl(key),
    key,
  };
}

/**
 * Upload a buffer directly to S3.
 */
export async function uploadFile(
  key: string,
  data: Buffer | ReadableStream | Blob,
  contentType: string
): Promise<string> {
  let body: Buffer;
  if (Buffer.isBuffer(data)) {
    body = data;
  } else if (data instanceof Blob) {
    body = Buffer.from(await data.arrayBuffer());
  } else {
    const chunks: Uint8Array[] = [];
    const reader = (data as ReadableStream).getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    body = Buffer.concat(chunks);
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return publicUrl(key);
}

/**
 * Delete a file from S3 (accepts a full URL or a bare key).
 */
export async function deleteFile(urlOrKey: string): Promise<void> {
  const key = extractKeyFromUrl(urlOrKey);
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Get metadata for an object in S3.
 */
export async function headFile(urlOrKey: string) {
  const key = extractKeyFromUrl(urlOrKey);
  const response = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return {
    size: response.ContentLength ?? 0,
    uploadedAt: response.LastModified ?? new Date(),
    url: publicUrl(key),
    contentType: response.ContentType,
  };
}

/**
 * Extract the S3 key from a full URL or return the string as-is if it's already a key.
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

export { s3 as s3Client, BUCKET, REGION };
