import type { Readable } from 'stream';

export interface StoredObjectInfo {
  size: number;
  contentType?: string;
  lastModified?: Date;
}

export interface PresignGetOptions {
  expiresIn: number;
  /** Sent back by S3 as the response Content-Type. */
  contentType: string;
  /** Sent back by S3 as the response Content-Disposition. */
  contentDisposition: string;
  /** Sent back by S3 as the response Cache-Control. */
  cacheControl?: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/**
 * The few operations the app needs from object storage. The S3 adapter is the
 * production implementation; the memory adapter backs tests.
 */
export interface ObjectStorage {
  readonly bucket: string;
  putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options: { contentType: string; contentLength?: number }
  ): Promise<void>;
  /** Size and type of an object, or null when it does not exist. */
  headObject(key: string): Promise<StoredObjectInfo | null>;
  deleteObject(key: string): Promise<void>;
  /** A one-shot PUT link that only accepts exactly this type and length. */
  presignPut(
    key: string,
    options: { contentType: string; contentLength: number; expiresIn: number }
  ): Promise<string>;
  createMultipartUpload(key: string, options: { contentType: string }): Promise<string>;
  presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number
  ): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  presignGet(key: string, options: PresignGetOptions): Promise<string>;
  /** Cheap reachability check for health endpoints. */
  ping(): Promise<void>;
}
