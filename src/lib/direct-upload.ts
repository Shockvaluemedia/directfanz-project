/**
 * Browser side of a direct upload to the private bucket.
 *
 * The server hands out signed links (/api/upload/presigned-url): one PUT link
 * for a small file, or one link per part for a large one. The browser sends
 * the bytes straight to storage, then asks the server to confirm the upload
 * (/api/upload/confirm), which checks the stored object and returns the
 * storage reference to save on the content row.
 *
 * Multipart uploads read each part's ETag from the response, so the bucket's
 * CORS rule must expose the ETag header.
 */

export interface DirectUploadInfo {
  uploadUrl: string;
  key: string;
  fileUrl?: string;
  contentType?: string;
  multipart?: {
    uploadId: string;
    partSize: number;
    parts: { partNumber: number; url: string }[];
  };
}

export interface ConfirmedDirectUpload {
  key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  /** Storage reference (s3://...), not a browser URL. */
  fileUrl: string;
}

export type DirectUploadProgress = (percentage: number) => void;

const PART_CONCURRENCY = 3;

function put(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress?: (loaded: number) => void
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', event => onProgress?.(event.loaded));
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(body.size);
        resolve(xhr.getResponseHeader('ETag'));
      } else {
        reject(new Error(`Upload to storage failed (HTTP ${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(body);
  });
}

async function uploadParts(
  file: File,
  plan: NonNullable<DirectUploadInfo['multipart']>,
  onProgress?: DirectUploadProgress
): Promise<{ partNumber: number; etag: string }[]> {
  const loaded = new Map<number, number>();
  const report = () => {
    const sum = Array.from(loaded.values()).reduce((a, b) => a + b, 0);
    onProgress?.(Math.min(99, (sum / file.size) * 100));
  };

  const results: { partNumber: number; etag: string }[] = [];
  const queue = [...plan.parts];
  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      const start = (part.partNumber - 1) * plan.partSize;
      const chunk = file.slice(start, Math.min(start + plan.partSize, file.size));
      // Part links are signed without a Content-Type.
      const etag = await put(part.url, chunk, null, bytes => {
        loaded.set(part!.partNumber, bytes);
        report();
      });
      if (!etag) {
        throw new Error('Storage did not return an ETag (check the bucket CORS ExposeHeaders)');
      }
      results.push({ partNumber: part.partNumber, etag });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, plan.parts.length) }, worker));
  return results.sort((a, b) => a.partNumber - b.partNumber);
}

/** Uploads `file` with the links from /api/upload/presigned-url and confirms it. */
export async function uploadDirect(
  file: File,
  info: DirectUploadInfo,
  onProgress?: DirectUploadProgress
): Promise<ConfirmedDirectUpload> {
  const contentType = info.contentType || file.type;
  let multipart: { uploadId: string; parts: { partNumber: number; etag: string }[] } | undefined;

  if (info.multipart) {
    const parts = await uploadParts(file, info.multipart, onProgress);
    multipart = { uploadId: info.multipart.uploadId, parts };
  } else {
    await put(info.uploadUrl, file, contentType, bytes =>
      onProgress?.(Math.min(99, (bytes / Math.max(file.size, 1)) * 100))
    );
  }

  const response = await fetch('/api/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: info.key, fileName: file.name, fileType: contentType, multipart }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.fileUrl) {
    throw new Error(payload?.error?.message || payload?.error || 'Failed to confirm upload');
  }
  onProgress?.(100);
  return payload.data as ConfirmedDirectUpload;
}
