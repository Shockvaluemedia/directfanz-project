/**
 * Browser side of a direct upload to the private bucket.
 *
 * The server hands out signed links (/api/upload/presigned-url): one PUT link
 * for a small file, or one link per part for a large one. The browser sends
 * the bytes straight to storage, then asks the server to confirm the upload
 * (/api/upload/confirm), which checks the stored object and returns the
 * storage reference to save on the content row.
 *
 * Long uploads ask /api/upload/parts for fresh part links as they go, since
 * links signed at the start expire before a film's last parts are sent.
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
/** Matches MAX_PART_LINKS_PER_REQUEST on the server. */
const MAX_LINKS_PER_REFRESH = 50;

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

/** Part links are refreshed once they are this old (they live 15 minutes). */
export const PART_LINK_REFRESH_MS = 10 * 60 * 1000;
/** Tries per part before the upload gives up. */
export const PART_ATTEMPTS = 3;

type PartLink = { url: string; signedAt: number };

export interface PartUploadDeps {
  /** PUTs one part and resolves to its ETag (null when none came back). */
  putPart: (url: string, body: Blob, onProgress: (loaded: number) => void) => Promise<string | null>;
  /** Fresh links for these part numbers (POST /api/upload/parts). */
  signParts: (partNumbers: number[]) => Promise<{ partNumber: number; url: string }[]>;
  now: () => number;
}

async function signPartsRequest(
  key: string,
  fileType: string,
  uploadId: string,
  partNumbers: number[]
): Promise<{ partNumber: number; url: string }[]> {
  const response = await fetch('/api/upload/parts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, fileType, uploadId, partNumbers }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload?.data?.parts)) {
    throw new Error(payload?.error?.message || 'Could not refresh upload links');
  }
  return payload.data.parts;
}

/**
 * Sends every part, three at a time. Links signed at the start can expire
 * before a long video's later parts are sent, so a link older than
 * PART_LINK_REFRESH_MS is re-signed (with the next queued parts in the same
 * request), and a failed part is retried with a fresh link.
 */
export async function uploadParts(
  file: Blob,
  plan: NonNullable<DirectUploadInfo['multipart']>,
  deps: PartUploadDeps,
  onProgress?: DirectUploadProgress
): Promise<{ partNumber: number; etag: string }[]> {
  const links = new Map<number, PartLink>(
    plan.parts.map(part => [part.partNumber, { url: part.url, signedAt: deps.now() }])
  );
  const loaded = new Map<number, number>();
  const report = () => {
    const sum = Array.from(loaded.values()).reduce((a, b) => a + b, 0);
    onProgress?.(Math.min(99, (sum / Math.max(file.size, 1)) * 100));
  };

  const queue = plan.parts.map(part => part.partNumber);
  const refresh = async (partNumber: number) => {
    const batch = [partNumber, ...queue.slice(0, MAX_LINKS_PER_REFRESH - 1)];
    const fresh = await deps.signParts(batch);
    const signedAt = deps.now();
    for (const link of fresh) links.set(link.partNumber, { url: link.url, signedAt });
  };
  const linkFor = async (partNumber: number, forceRefresh: boolean): Promise<string> => {
    const link = links.get(partNumber);
    if (forceRefresh || !link || deps.now() - link.signedAt > PART_LINK_REFRESH_MS) {
      await refresh(partNumber);
    }
    const url = links.get(partNumber)?.url;
    if (!url) throw new Error('Upload link missing for part ' + partNumber);
    return url;
  };

  const results: { partNumber: number; etag: string }[] = [];
  const sendPart = async (partNumber: number) => {
    const start = (partNumber - 1) * plan.partSize;
    const chunk = file.slice(start, Math.min(start + plan.partSize, file.size));
    let lastError: unknown;
    for (let attempt = 1; attempt <= PART_ATTEMPTS; attempt++) {
      try {
        const url = await linkFor(partNumber, attempt > 1);
        const etag = await deps.putPart(url, chunk, bytes => {
          loaded.set(partNumber, bytes);
          report();
        });
        if (!etag) {
          throw new Error('Storage did not return an ETag (check the bucket CORS ExposeHeaders)');
        }
        return etag;
      } catch (error) {
        lastError = error;
        loaded.set(partNumber, 0);
        if (error instanceof Error && /ETag|cancelled/.test(error.message)) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Upload failed');
  };

  const worker = async () => {
    for (let partNumber = queue.shift(); partNumber !== undefined; partNumber = queue.shift()) {
      results.push({ partNumber, etag: await sendPart(partNumber) });
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
    const plan = info.multipart;
    const parts = await uploadParts(
      file,
      plan,
      {
        // Part links are signed without a Content-Type.
        putPart: (url, body, onLoaded) => put(url, body, null, onLoaded),
        signParts: numbers => signPartsRequest(info.key, contentType, plan.uploadId, numbers),
        now: () => Date.now(),
      },
      onProgress
    );
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
