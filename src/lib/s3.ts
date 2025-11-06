import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client dynamically to ensure environment variables are loaded
let _s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!_s3Client) {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing AWS credentials: AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required');
    }
    
    _s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return _s3Client;
};

// Export the getter function for dynamic access
export { getS3Client as s3Client };

// Use a getter function to ensure environment variables are loaded when accessed
const getBucketName = () => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
  }
  return bucketName;
};

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

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  artistId: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

/**
 * Generate a presigned URL for file upload
 */
export async function generatePresignedUrl({
  fileName,
  fileType,
  fileSize,
  artistId,
}: PresignedUrlRequest): Promise<PresignedUrlResponse> {
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

  // Generate unique key for the file
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `content/${artistId}/${timestamp}-${sanitizedFileName}`;

  // Create the put object command
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: fileType,
    ContentLength: fileSize,
    Metadata: {
      artistId,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Generate presigned URL (expires in 1 hour)
  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });

  // Construct the public URL for the file
  const fileUrl = `https://${getBucketName()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    uploadUrl,
    fileUrl,
    key,
  };
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await getS3Client().send(command);
}

/**
 * Extract file key from S3 URL
 */
export function extractKeyFromUrl(url: string): string {
  const bucketName = getBucketName();
  const urlParts = url.split('/');
  const bucketIndex = urlParts.findIndex(part => part.includes(bucketName));
  if (bucketIndex === -1) {
    throw new Error('Invalid S3 URL');
  }
  return urlParts.slice(bucketIndex + 1).join('/');
}

/**
 * Validate file upload parameters
 */
export function validateFileUpload(fileName: string, fileType: string, fileSize: number) {
  const errors: string[] = [];

  // Check file type
  if (!SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES]) {
    errors.push(`Unsupported file type: ${fileType}`);
  } else {
    const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];

    // Check file size
    if (fileSize > FILE_SIZE_LIMITS[fileInfo.category]) {
      const limitMB = FILE_SIZE_LIMITS[fileInfo.category] / (1024 * 1024);
      errors.push(`File size exceeds limit of ${limitMB}MB for ${fileInfo.category} files`);
    }
  }

  // Check file name
  if (!fileName || fileName.trim().length === 0) {
    errors.push('File name is required');
  }

  if (fileSize <= 0) {
    errors.push('File size must be greater than 0');
  }

  return errors;
}
