/**
 * Storage references, free of any AWS SDK import so middleware (edge) and
 * client-shaping code can use them.
 *
 * Files live in one private S3 bucket. The database stores a reference of the
 * form `s3://<bucket>/<key>`, never a URL a browser could fetch. Readers turn a
 * reference into a short-lived signed link only after an access check.
 *
 * Every helper pins references to the configured bucket (AWS_S3_BUCKET_NAME), the
 * same fail-closed rule the media proxy applies to Blob hosts: a reference to
 * any other bucket is treated as unknown.
 */

export const STORAGE_SCHEME = 's3://';

/** Keys are app-generated; anything outside this alphabet is rejected. */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9!_.*'()\/-]{0,1023}$/;

/**
 * The media bucket. AWS_S3_BUCKET_NAME is what the ECS task definition in
 * infra/aws sets (it also sets S3_BUCKET_NAME to the same value).
 */
export function storageBucket(): string | null {
  const bucket = (process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || '').trim();
  return bucket ? bucket : null;
}

export function storageRegion(): string | null {
  const region = (process.env.AWS_REGION ?? '').trim();
  return region ? region : null;
}

/** A key the app would have written itself: no traversal, no empty segments. */
export function isSafeKey(key: string): boolean {
  if (!SAFE_KEY.test(key)) return false;
  return key.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

export function isStorageRef(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(STORAGE_SCHEME);
}

export function toStorageRef(key: string, bucket: string | null = storageBucket()): string {
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME is not configured');
  if (!isSafeKey(key)) throw new Error('Invalid storage key');
  return `${STORAGE_SCHEME}${bucket}/${key}`;
}

/**
 * The key inside a reference, or null when the value is not a reference to the
 * configured bucket or the key is not one the app could have written.
 */
export function keyFromStorageRef(value: string | null | undefined): string | null {
  if (!value || !isStorageRef(value)) return null;
  const bucket = storageBucket();
  if (!bucket) return null;
  const rest = value.slice(STORAGE_SCHEME.length);
  if (!rest.startsWith(`${bucket}/`)) return null;
  const key = rest.slice(bucket.length + 1);
  return isSafeKey(key) ? key : null;
}

/** Every key a user uploads lives under this prefix. */
export function userKeyPrefix(userId: string): string {
  return `content/${userId}/`;
}

export function isKeyOwnedBy(key: string, userId: string): boolean {
  return Boolean(userId) && isSafeKey(key) && key.startsWith(userKeyPrefix(userId));
}

/**
 * Content routes accept a file reference from the client. A storage reference
 * must point into the configured bucket and into the caller's own prefix, so
 * one artist can never publish another artist's paid file under a free row.
 * Returns an error message, or null when the value is acceptable (including
 * every non-storage value, which the route validates as before).
 */
export function storageRefOwnershipError(
  value: string | null | undefined,
  userId: string
): string | null {
  if (!isStorageRef(value)) return null;
  const key = keyFromStorageRef(value);
  if (!key) return 'File reference does not point at this app’s storage';
  if (!isKeyOwnedBy(key, userId)) return 'File reference belongs to another account';
  return null;
}

/**
 * The bucket's https origin, for the CSP: browsers upload to it directly
 * (connect-src) and play media from signed links on it (media-src, img-src).
 * Assumes a DNS-compatible bucket name without dots (virtual-hosted style).
 */
export function storageOrigin(): string | null {
  const endpoint = (process.env.S3_MEDIA_ENDPOINT ?? '').trim();
  if (endpoint) {
    try {
      return new URL(endpoint).origin;
    } catch {
      return null;
    }
  }
  const bucket = storageBucket();
  const region = storageRegion();
  if (!bucket || !region || bucket.includes('.')) return null;
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}
