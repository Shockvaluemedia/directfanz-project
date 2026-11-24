import { randomUUID } from 'crypto';
import {
  FILE_SIZE_LIMITS,
  MAX_PART_LINKS_PER_REQUEST,
  maxPartsFor,
  UPLOAD_PURPOSES,
  purposeAllowsType,
  type UploadPurpose,
  MULTIPART_PART_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  SUPPORTED_FILE_TYPES,
  validateFileUpload,
  type UploadRequest,
  type UploadResponse,
} from '@/lib/upload-policy';
import { getObjectStorage, signedUrlTtl } from './index';
import { isKeyOwnedBy, keyArea, toMediaPath, toStorageRef, userKeyPrefix, type KeyArea } from './refs';
import type { CompletedPart, ObjectStorage } from './types';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured');
    this.name = 'StorageNotConfiguredError';
  }
}

export class UploadRejectedError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400
  ) {
    super(message);
    this.name = 'UploadRejectedError';
  }
}

function requireStorage(): ObjectStorage {
  const storage = getObjectStorage();
  if (!storage) throw new StorageNotConfiguredError();
  return storage;
}

type SupportedType = keyof typeof SUPPORTED_FILE_TYPES;

function fileInfo(fileType: string) {
  return SUPPORTED_FILE_TYPES[fileType as SupportedType];
}

/**
 * A fresh, unguessable key under the user's own folder for the purpose. The
 * extension comes from the validated type, never from the client's file name.
 */
export function newUploadKey(userId: string, fileType: string, purpose: UploadPurpose = 'content'): string {
  const info = fileInfo(fileType);
  if (!info) throw new UploadRejectedError(`Unsupported file type: ${fileType}`);
  const area = UPLOAD_PURPOSES[purpose].area;
  return `${userKeyPrefix(userId, area)}${info.category.toLowerCase()}/${Date.now()}-${randomUUID()}.${info.extension}`;
}

/** What a row stores for a key: content keeps s3:// references, the rest media paths. */
export function storedValueForKey(key: string, bucket: string): string {
  return keyArea(key) === 'content' ? toStorageRef(key, bucket) : toMediaPath(key);
}

/** Categories each storage area accepts (the union of its purposes). */
function areaAllowsType(area: KeyArea, fileType: string): boolean {
  return (Object.keys(UPLOAD_PURPOSES) as UploadPurpose[]).some(
    purpose => UPLOAD_PURPOSES[purpose].area === area && purposeAllowsType(purpose, fileType)
  );
}

/**
 * Starts a direct-to-storage upload. Small files get one signed PUT link that
 * only accepts the validated type and exact size; large files get a multipart
 * upload with one signed link per part. The app never buffers the bytes.
 */
export async function createDirectUpload({
  fileName,
  fileType,
  fileSize,
  artistId,
  purpose = 'content',
}: UploadRequest): Promise<UploadResponse> {
  const errors = validateFileUpload(fileName, fileType, fileSize);
  if (errors.length > 0) throw new UploadRejectedError(errors.join('; '));
  if (!purposeAllowsType(purpose, fileType)) {
    throw new UploadRejectedError(`This kind of upload does not accept ${fileType} files`);
  }

  const storage = requireStorage();
  const key = newUploadKey(artistId, fileType, purpose);
  const fileUrl = storedValueForKey(key, storage.bucket);
  const expiresIn = signedUrlTtl.upload();

  if (fileSize < MULTIPART_THRESHOLD_BYTES) {
    const uploadUrl = await storage.presignPut(key, { contentType: fileType, contentLength: fileSize, expiresIn });
    return { uploadUrl, fileUrl, key, contentType: fileType };
  }

  const uploadId = await storage.createMultipartUpload(key, { contentType: fileType });
  const partCount = Math.ceil(fileSize / MULTIPART_PART_BYTES);
  const parts = await Promise.all(
    Array.from({ length: partCount }, async (_, index) => ({
      partNumber: index + 1,
      url: await storage.presignUploadPart(key, uploadId, index + 1, expiresIn),
    }))
  );
  return {
    uploadUrl: '',
    fileUrl,
    key,
    contentType: fileType,
    multipart: { uploadId, partSize: MULTIPART_PART_BYTES, parts },
  };
}

export interface SignPartsInput {
  userId: string;
  key: string;
  fileType: string;
  uploadId: string;
  partNumbers: number[];
  /** Content uploads (paid media) are for artists only. */
  isArtist: boolean;
}

/**
 * Fresh signed links for parts of a multipart upload that is still open.
 *
 * Part links live for S3_UPLOAD_URL_TTL_SECONDS (15 minutes by default), and a
 * link signed with the task role's temporary credentials can die sooner. A
 * documentary or film can take longer than that to send, so the browser asks
 * for new links as it goes instead of using ones signed at the start. The same
 * checks as confirmation apply: the key must be the caller's own, of an
 * allowed type for its area, and the part numbers within the type's limit.
 */
export async function signUploadParts(input: SignPartsInput): Promise<{ partNumber: number; url: string }[]> {
  const storage = requireStorage();
  if (!isKeyOwnedBy(input.key, input.userId)) {
    throw new UploadRejectedError('Upload does not belong to this account', 403);
  }
  const info = fileInfo(input.fileType);
  if (!info) throw new UploadRejectedError(`Unsupported file type: ${input.fileType}`);
  const area = keyArea(input.key);
  if (!area || !areaAllowsType(area, input.fileType) || !input.key.endsWith(`.${info.extension}`)) {
    throw new UploadRejectedError('File type is not allowed for this upload');
  }
  if (area === 'content' && !input.isArtist) {
    throw new UploadRejectedError('Artist account required', 403);
  }
  const maxParts = maxPartsFor(input.fileType);
  const numbers = Array.from(new Set(input.partNumbers));
  if (
    numbers.length === 0 ||
    numbers.length > MAX_PART_LINKS_PER_REQUEST ||
    !numbers.every(n => Number.isInteger(n) && n >= 1 && n <= maxParts)
  ) {
    throw new UploadRejectedError('Invalid part numbers');
  }

  const expiresIn = signedUrlTtl.upload();
  return Promise.all(
    numbers.map(async partNumber => ({
      partNumber,
      url: await storage.presignUploadPart(input.key, input.uploadId, partNumber, expiresIn),
    }))
  );
}

export interface ConfirmUploadInput {
  userId: string;
  key: string;
  fileType: string;
  /** Content uploads (paid media) are for artists only. */
  isArtist: boolean;
  multipart?: { uploadId: string; parts: CompletedPart[] };
}

export interface ConfirmedUpload {
  key: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
}

/**
 * Finishes an upload: completes a multipart upload if there is one, then checks
 * the stored object really exists, belongs to the caller and is within the size
 * limit for its type. An object that fails the checks is deleted.
 */
export async function confirmDirectUpload(input: ConfirmUploadInput): Promise<ConfirmedUpload> {
  const storage = requireStorage();
  if (!isKeyOwnedBy(input.key, input.userId)) {
    throw new UploadRejectedError('Upload does not belong to this account', 403);
  }
  const info = fileInfo(input.fileType);
  if (!info) throw new UploadRejectedError(`Unsupported file type: ${input.fileType}`);
  const area = keyArea(input.key);
  if (!area || !areaAllowsType(area, input.fileType)) {
    throw new UploadRejectedError('File type is not allowed for this upload');
  }
  if (area === 'content' && !input.isArtist) {
    throw new UploadRejectedError('Artist account required', 403);
  }
  if (!input.key.endsWith(`.${info.extension}`)) {
    throw new UploadRejectedError('File type does not match the upload');
  }

  if (input.multipart) {
    const { uploadId, parts } = input.multipart;
    const maxParts = maxPartsFor(input.fileType);
    const valid =
      parts.length > 0 &&
      parts.length <= maxParts &&
      parts.every((part, index) => part.partNumber === index + 1 && typeof part.etag === 'string' && part.etag.length > 0);
    if (!valid) {
      await storage.abortMultipartUpload(input.key, uploadId).catch(() => undefined);
      throw new UploadRejectedError('Upload parts are incomplete');
    }
    try {
      await storage.completeMultipartUpload(input.key, uploadId, parts);
    } catch {
      await storage.abortMultipartUpload(input.key, uploadId).catch(() => undefined);
      throw new UploadRejectedError('Upload could not be completed');
    }
  }

  const head = await storage.headObject(input.key);
  if (!head) throw new UploadRejectedError('File not found in storage', 404);

  if (head.size <= 0 || head.size > FILE_SIZE_LIMITS[info.category]) {
    await storage.deleteObject(input.key);
    throw new UploadRejectedError('Uploaded file is empty or over the size limit');
  }

  return {
    key: input.key,
    fileUrl: storedValueForKey(input.key, storage.bucket),
    fileSize: head.size,
    uploadedAt: head.lastModified ?? new Date(),
  };
}

/**
 * Server-side write for files the app produces itself (optimised images,
 * thumbnails, processed media). Returns the storage reference.
 */
export async function storeServerFile(key: string, body: Buffer, contentType: string): Promise<string> {
  const storage = requireStorage();
  await storage.putObject(key, body, { contentType, contentLength: body.length });
  return toStorageRef(key, storage.bucket);
}
