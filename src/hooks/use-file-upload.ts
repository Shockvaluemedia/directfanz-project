import { useState } from 'react';
import { toast } from 'react-hot-toast';

export interface UploadedFile {
  key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function useFileUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());

  const updateUploadProgress = (fileName: string, update: Partial<UploadProgress>) => {
    setUploads(prev => {
      const newUploads = new Map(prev);
      const existing = newUploads.get(fileName) || {
        fileName,
        progress: 0,
        status: 'pending' as const,
      };
      newUploads.set(fileName, { ...existing, fileName, ...update });
      return newUploads;
    });
  };

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const fileName = file.name;

    // Initialize progress
    updateUploadProgress(fileName, {
      progress: 0,
      status: 'pending',
    });

    try {
      // Step 1: Get presigned URL
      updateUploadProgress(fileName, { status: 'uploading', progress: 10 });

      const presignedResponse = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json();
        throw new Error(error.error?.message || 'Failed to get upload URL');
      }

      const { data: uploadInfo } = await presignedResponse.json();
      updateUploadProgress(fileName, { progress: 20 });

      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      updateUploadProgress(fileName, { progress: 80 });

      // Step 3: Confirm upload
      const confirmResponse = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: uploadInfo.key,
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error?.message || 'Failed to confirm upload');
      }

      const { data: confirmedFile } = await confirmResponse.json();

      updateUploadProgress(fileName, {
        progress: 100,
        status: 'completed',
      });

      toast.success(`Successfully uploaded ${fileName}`);
      return confirmedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      updateUploadProgress(fileName, {
        status: 'error',
        error: errorMessage,
        progress: 0,
      });

      toast.error(`Failed to upload ${fileName}: ${errorMessage}`);
      throw error;
    }
  };

  const uploadMultipleFiles = async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const fileArray = Array.from(files);
    const results: UploadedFile[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const file of fileArray) {
      try {
        const result = await uploadFile(file);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        errors.push({ file: file.name, error: errorMessage });
      }
    }

    if (errors.length > 0) {
      console.warn('Some uploads failed:', errors);
    }

    return results;
  };

  const clearUpload = (fileName: string) => {
    setUploads(prev => {
      const newUploads = new Map(prev);
      newUploads.delete(fileName);
      return newUploads;
    });
  };

  const clearAllUploads = () => {
    setUploads(new Map());
  };

  return {
    uploads: Array.from(uploads.values()),
    uploadFile,
    uploadMultipleFiles,
    clearUpload,
    clearAllUploads,
  };
}
