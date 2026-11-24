/**
 * Server-side upload helpers backed by the private S3 bucket.
 *
 * The file rules themselves live in `@/lib/upload-policy` so client components
 * can import them without pulling in the storage SDK; they are re-exported
 * here for existing server callers.
 */
import { deleteStoredFile } from '@/lib/storage';
import { createDirectUpload } from '@/lib/storage/uploads';
import type { UploadRequest, UploadResponse } from '@/lib/upload-policy';

export {
  SUPPORTED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  MULTIPART_THRESHOLD_BYTES,
  MULTIPART_PART_BYTES,
  validateFileUpload,
} from '@/lib/upload-policy';
export type { UploadRequest, UploadResponse, MultipartUploadPlan } from '@/lib/upload-policy';

/**
 * Signed upload link(s) for a direct browser-to-S3 upload. Throws when the file
 * is not allowed or storage is not configured.
 */
export function generatePresignedUrl(request: UploadRequest): Promise<UploadResponse> {
  return createDirectUpload(request);
}

/** Deletes a stored file, only when it sits in the owner's own prefix. */
export function deleteFile(fileRef: string, ownerId: string): Promise<void> {
  return deleteStoredFile(fileRef, ownerId);
}
