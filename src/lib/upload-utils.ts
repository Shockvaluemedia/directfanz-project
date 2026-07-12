export interface UploadConfig {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface PresignedUrlResponse {
  success: boolean;
  data: {
    uploadUrl: string;
    fileUrl: string;
    key: string;
    useLocalStorage: boolean;
    fields?: Record<string, string>;
  };
}

export interface UploadProgressCallback {
  (progress: number): void;
}

export async function getPresignedUrl(config: UploadConfig): Promise<PresignedUrlResponse> {
  const response = await fetch('/api/upload/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get presigned URL' }));
    throw new Error(error.error || `HTTP ${response.status}: Failed to get presigned URL`);
  }

  return response.json();
}

export async function uploadFileWithProgress(
  file: File,
  uploadInfo: PresignedUrlResponse['data'],
  onProgress?: UploadProgressCallback
): Promise<string> {
  if (uploadInfo.useLocalStorage) {
    return uploadToContentApi(file, onProgress);
  }
  return uploadToS3(file, uploadInfo, onProgress);
}

// When object storage (S3 / Vercel Blob) is not configured, persist the file
// through the hardened /api/upload endpoint, which validates the type/size and
// writes it to local content storage, returning a servable /api/files URL.
// Previously this "local" path only animated a progress bar and returned a URL
// pointing at a file that was never stored, so uploads silently lost data.
async function uploadToContentApi(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('files', file);

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        onProgress?.((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const res = JSON.parse(xhr.responseText);
        const first = res?.files?.[0];
        if (xhr.status >= 200 && xhr.status < 300 && first?.success && first.url) {
          onProgress?.(100);
          resolve(first.url as string);
        } else {
          reject(new Error(first?.error || res?.error || `Upload failed (HTTP ${xhr.status})`));
        }
      } catch {
        reject(new Error('Upload failed: invalid server response'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

async function uploadToS3(
  file: File,
  uploadInfo: PresignedUrlResponse['data'],
  onProgress?: UploadProgressCallback
): Promise<string> {
  const xhr = new XMLHttpRequest();
  
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress?.(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 204) {
        resolve(uploadInfo.fileUrl);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    if (uploadInfo.fields) {
      const formData = new FormData();
      Object.entries(uploadInfo.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);
      xhr.open('POST', uploadInfo.uploadUrl);
      xhr.send(formData);
    } else {
      xhr.open('PUT', uploadInfo.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    }
  });
}

export function validateFile(file: File): string[] {
  const errors: string[] = [];
  
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }
  
  if (file.size === 0) {
    errors.push('File cannot be empty');
  }
  
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/avi', 'video/mov', 
    'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac',
    'application/pdf', 'text/plain'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  return errors;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
