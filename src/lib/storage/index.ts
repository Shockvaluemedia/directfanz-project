import { logger } from '@/lib/logger';
import { MemoryObjectStorage } from './memory-storage';
import { S3ObjectStorage } from './s3-storage';
import { isKeyOwnedBy, storageBucket, storageKeyOf, storageRegion } from './refs';
import type { ObjectStorage } from './types';

export * from './refs';
export type { ObjectStorage, StoredObjectInfo, CompletedPart, PresignGetOptions } from './types';
export { MemoryObjectStorage } from './memory-storage';

let override: ObjectStorage | null | undefined;
let cached: { signature: string; storage: ObjectStorage | null } | undefined;

/**
 * The app's object storage, or null when none is configured (local
 * development then keeps using the on-disk uploaders).
 *
 * - AWS_S3_BUCKET_NAME + AWS_REGION: the private S3 bucket.
 * - STORAGE_DRIVER=memory: in-process storage, for tests and demos only.
 */
export function getObjectStorage(): ObjectStorage | null {
  if (override !== undefined) return override;

  const bucket = storageBucket();
  const region = storageRegion();
  const endpoint = (process.env.S3_MEDIA_ENDPOINT ?? '').trim() || undefined;
  const driver = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  const signature = [driver, bucket, region, endpoint].join('|');
  if (cached && cached.signature === signature) return cached.storage;

  let storage: ObjectStorage | null = null;
  if (driver === 'memory') {
    storage = new MemoryObjectStorage(bucket ?? 'memory-bucket');
  } else if (bucket && region) {
    storage = new S3ObjectStorage({ bucket, region, endpoint });
  } else if (bucket) {
    logger.warn('AWS_S3_BUCKET_NAME is set but AWS_REGION is not; storage disabled');
  }
  cached = { signature, storage };
  return storage;
}

/** Tests only: force a storage instance (or null for "not configured"). */
export function setObjectStorageForTests(storage: ObjectStorage | null | undefined): void {
  override = storage;
  cached = undefined;
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Lifetime of signed links. Short enough that a shared link dies quickly. */
export const signedUrlTtl = {
  /** Playback links: long enough to finish watching without a re-request. */
  stream: () => positiveIntFromEnv('S3_STREAM_URL_TTL_SECONDS', 60 * 60),
  /** Download and thumbnail links. */
  download: () => positiveIntFromEnv('S3_DOWNLOAD_URL_TTL_SECONDS', 5 * 60),
  /** Upload links (single PUT and each multipart part). */
  upload: () => positiveIntFromEnv('S3_UPLOAD_URL_TTL_SECONDS', 15 * 60),
};

/**
 * Deletes the object behind a stored reference, but only when it is in this
 * app's bucket and inside the owner's own prefix. Old Blob URLs and local paths
 * are left alone: Blob is retired once the copy script has run.
 */
export async function deleteStoredFile(ref: string | null | undefined, ownerId: string): Promise<void> {
  const key = storageKeyOf(ref);
  if (!key) return;
  if (!isKeyOwnedBy(key, ownerId)) {
    logger.warn('Refusing to delete a stored file outside the owner’s prefix', { ownerId });
    return;
  }
  const storage = getObjectStorage();
  if (!storage) return;
  await storage.deleteObject(key);
}
