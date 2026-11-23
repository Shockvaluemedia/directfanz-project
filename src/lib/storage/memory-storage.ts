import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import type { CompletedPart, ObjectStorage, PresignGetOptions, StoredObjectInfo } from './types';

interface StoredObject {
  body: Buffer;
  contentType: string;
  lastModified: Date;
}

/**
 * In-memory storage for tests and for running without AWS. Presigned links
 * point at a reserved `.invalid` host and carry their parameters in the query
 * string, so tests can assert on them; nothing ever fetches them.
 */
export class MemoryObjectStorage implements ObjectStorage {
  readonly bucket: string;
  readonly objects = new Map<string, StoredObject>();
  readonly multipart = new Map<string, { key: string; contentType: string; parts: Map<number, Buffer> }>();

  constructor(bucket = 'memory-bucket') {
    this.bucket = bucket;
  }

  private link(action: string, key: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(`https://memory-storage.invalid/${this.bucket}/${key}`);
    url.searchParams.set('action', action);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    return url.toString();
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options: { contentType: string; contentLength?: number }
  ): Promise<void> {
    let buffer: Buffer;
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      buffer = Buffer.concat(chunks);
    } else {
      buffer = Buffer.from(body);
    }
    this.objects.set(key, { body: buffer, contentType: options.contentType, lastModified: new Date() });
  }

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    const object = this.objects.get(key);
    return object
      ? { size: object.body.length, contentType: object.contentType, lastModified: object.lastModified }
      : null;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async presignPut(
    key: string,
    options: { contentType: string; contentLength: number; expiresIn: number }
  ): Promise<string> {
    return this.link('put', key, {
      contentType: options.contentType,
      contentLength: options.contentLength,
      expiresIn: options.expiresIn,
    });
  }

  async createMultipartUpload(key: string, options: { contentType: string }): Promise<string> {
    const uploadId = randomUUID();
    this.multipart.set(uploadId, { key, contentType: options.contentType, parts: new Map() });
    return uploadId;
  }

  async presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn: number): Promise<string> {
    return this.link('part', key, { uploadId, partNumber, expiresIn });
  }

  /** Test helper: what a browser PUT to a part link would do. Returns the ETag. */
  uploadPart(uploadId: string, partNumber: number, body: Buffer): string {
    const upload = this.multipart.get(uploadId);
    if (!upload) throw new Error('NoSuchUpload');
    upload.parts.set(partNumber, body);
    return `"etag-${partNumber}"`;
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    const upload = this.multipart.get(uploadId);
    if (!upload || upload.key !== key) throw new Error('NoSuchUpload');
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const bodies = ordered.map(part => {
      const body = upload.parts.get(part.partNumber);
      if (!body || part.etag !== `"etag-${part.partNumber}"`) throw new Error('InvalidPart');
      return body;
    });
    this.objects.set(key, { body: Buffer.concat(bodies), contentType: upload.contentType, lastModified: new Date() });
    this.multipart.delete(uploadId);
  }

  async abortMultipartUpload(_key: string, uploadId: string): Promise<void> {
    this.multipart.delete(uploadId);
  }

  async presignGet(key: string, options: PresignGetOptions): Promise<string> {
    return this.link('get', key, {
      expiresIn: options.expiresIn,
      contentType: options.contentType,
      contentDisposition: options.contentDisposition,
      cacheControl: options.cacheControl,
    });
  }

  async ping(): Promise<void> {}
}
