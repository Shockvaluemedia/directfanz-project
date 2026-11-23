/**
 * Storage references, free of any AWS SDK import so middleware (edge) and
 * client-shaping code can use them.
 *
 * Files live in one private S3 bucket. The database stores either a reference
 * of the form `s3://<bucket>/<key>` (paid media, never sent to a browser) or a
 * media path `/api/media/<key>` (files the browser loads directly). Either way
 * the bytes are only reachable through a short-lived signed link handed out
 * after an access check.
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

/**
 * Where a key lives decides who may read it:
 * - `content/<userId>/...`: paid or gated media. Stored as an s3:// reference
 *   (content files, recordings) or, for content thumbnails, as a media path
 *   that /api/media serves only after the owning row's access check.
 * - `public/<userId>/...`: avatars, covers, banners, stream thumbnails and
 *   other images meant for anyone. Stored as a media path.
 * - `private/<userId>/...`: message attachments. Stored as a media path that
 *   only the uploader and the people in that conversation can open.
 */
export const KEY_AREAS = ['content', 'public', 'private'] as const;
export type KeyArea = (typeof KEY_AREAS)[number];

export function keyArea(key: string): KeyArea | null {
  const area = key.split('/')[0];
  return (KEY_AREAS as readonly string[]).includes(area) ? (area as KeyArea) : null;
}

/** Every key a user uploads lives under one of these prefixes. */
export function userKeyPrefix(userId: string, area: KeyArea = 'content'): string {
  return `${area}/${userId}/`;
}

/** True when the key sits in the user's own folder of any area. */
export function isKeyOwnedBy(key: string, userId: string): boolean {
  if (!userId || !isSafeKey(key)) return false;
  const area = keyArea(key);
  return area !== null && key.startsWith(userKeyPrefix(userId, area));
}

/**
 * The browser-facing form of a stored file: an app path served by
 * /api/media, which checks access by area and then redirects to a short-lived
 * signed link. Columns the browser loads directly (avatars, covers, message
 * attachments, thumbnails) store this, so every API that returns them hands
 * out something that works without per-route mapping.
 */
export const MEDIA_PATH_PREFIX = '/api/media/';

export function isMediaPath(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(MEDIA_PATH_PREFIX);
}

export function toMediaPath(key: string): string {
  if (!isSafeKey(key)) throw new Error('Invalid storage key');
  return `${MEDIA_PATH_PREFIX}${key}`;
}

export function keyFromMediaPath(value: string | null | undefined): string | null {
  if (!value || !isMediaPath(value)) return null;
  const key = value.slice(MEDIA_PATH_PREFIX.length);
  return isSafeKey(key) && keyArea(key) !== null ? key : null;
}

/** The key behind either stored form, or null. */
export function storageKeyOf(value: string | null | undefined): string | null {
  return keyFromStorageRef(value) ?? keyFromMediaPath(value);
}

/** True for either stored form (whether or not it is valid). */
export function isStoredFile(value: string | null | undefined): boolean {
  return isStorageRef(value) || isMediaPath(value);
}

/**
 * Routes accept file references from the client. A stored file must point
 * into the configured bucket and into the caller's own folder, so one user can
 * never attach another user's paid file or private attachment to a row they
 * control (which would hand it out under their own access rules). A public
 * media path is the one exception: it is readable by anyone anyway.
 * Returns an error message, or null when the value is acceptable (including
 * every value that is not a stored file, which the route validates as before).
 */
export function storageRefOwnershipError(
  value: string | null | undefined,
  userId: string
): string | null {
  if (!isStoredFile(value)) return null;
  const key = storageKeyOf(value);
  if (!key) return 'File reference does not point at this app’s storage';
  if (isMediaPath(value) && keyArea(key) === 'public') return null;
  if (!isKeyOwnedBy(key, userId)) return 'File reference belongs to another account';
  return null;
}

/**
 * Normalises a client-supplied thumbnail or image reference to the stored
 * media path form. An s3:// reference (what upload confirmation returns for
 * content) becomes the matching media path; anything else is unchanged.
 */
export function asMediaPath(value: string | null | undefined): string | null | undefined {
  if (!isStorageRef(value)) return value;
  const key = keyFromStorageRef(value);
  return key ? toMediaPath(key) : value;
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
