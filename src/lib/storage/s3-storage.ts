import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import type { CompletedPart, ObjectStorage, PresignGetOptions, StoredObjectInfo } from './types';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Only for S3-compatible local stacks (MinIO, LocalStack); uses path-style. */
  endpoint?: string;
}

/**
 * Private-bucket storage on Amazon S3.
 *
 * Credentials come from the SDK's default provider chain, which on ECS Fargate
 * is the task role. No access keys are read here, and none should be set in
 * the app's environment.
 */
export class S3ObjectStorage implements ObjectStorage {
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: S3StorageConfig, client?: S3Client) {
    this.bucket = config.bucket;
    this.client =
      client ??
      new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
        // The SDK's default flexible checksums put a checksum of an empty body
        // into presigned PUT links, which browsers then fail. Only send
        // checksums where S3 requires them.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options: { contentType: string; contentLength?: number }
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ...(options.contentLength !== undefined ? { ContentLength: options.contentLength } : {}),
      })
    );
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: out.ContentLength ?? 0,
        contentType: out.ContentType,
        lastModified: out.LastModified,
      };
    } catch (error) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  presignPut(
    key: string,
    options: { contentType: string; contentLength: number; expiresIn: number }
  ): Promise<string> {
    // Content-Type and Content-Length are signed, so S3 refuses a PUT whose
    // size or declared type differs from what the server validated.
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
      }),
      { expiresIn: options.expiresIn, signableHeaders: new Set(['content-type', 'content-length']) }
    );
  }

  async createMultipartUpload(key: string, options: { contentType: string }): Promise<string> {
    const out = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: options.contentType })
    );
    if (!out.UploadId) throw new Error('S3 did not return an upload id');
    return out.UploadId;
  }

  presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn }
    );
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map(part => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      })
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId })
    );
  }

  presignGet(key: string, options: PresignGetOptions): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: options.contentType,
        ResponseContentDisposition: options.contentDisposition,
        ...(options.cacheControl ? { ResponseCacheControl: options.cacheControl } : {}),
      }),
      { expiresIn: options.expiresIn }
    );
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}
