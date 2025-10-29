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
    return simulateLocalUpload(file, uploadInfo.fileUrl, onProgress);
  }
  return uploadToS3(file, uploadInfo, onProgress);
}

async function simulateLocalUpload(
  file: File,
  fileUrl: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const totalSteps = 10;
  for (let step = 1; step <= totalSteps; step++) {
    const progress = (step / totalSteps) * 100;
    onProgress?.(progress);
    const delay = Math.random() * 200 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return fileUrl;
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
