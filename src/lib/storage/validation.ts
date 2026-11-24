import { z } from 'zod';
import { isMediaPath, isStorageRef } from './refs';

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Files written to local disk in development (/api/upload, LocalFileUploader). */
function isLocalFilePath(value: string): boolean {
  return /^\/(api\/files\/content|uploads)\/[^?#]+$/.test(value) && !value.includes('..');
}

/**
 * A file field from the client: an http(s) URL (older Blob files and outside
 * links), an s3:// reference or an /api/media/ path returned by upload
 * confirmation, or a local development path. Ownership of stored files is checked separately, where the
 * route knows who is writing (storageRefOwnershipError).
 */
export function fileUrlField(message = 'Invalid file URL') {
  return z
    .string()
    .min(1)
    .max(2048)
    .refine(value => isHttpUrl(value) || isStorageRef(value) || isMediaPath(value) || isLocalFilePath(value), message);
}
