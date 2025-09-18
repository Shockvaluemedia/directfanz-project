'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { MAX_FILE_SIZES, ALLOWED_EXTENSIONS, ContentType } from '@/lib/upload-constants';

interface FileUploadProps {
  onUpload: (file: File, metadata: ContentMetadata) => Promise<void>;
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
  className?: string;
  disabled?: boolean;
}

export interface ContentMetadata {
  title: string;
  description?: string;
  isPublic: boolean;
  tierIds: string[];
  tags: string[];
}

interface FilePreview {
  file: File;
  url: string;
  type: ContentType;
}

export function FileUpload({ onUpload, onProgress, className = '', disabled = false }: FileUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [metadata, setMetadata] = useState<ContentMetadata>({
    title: '',
    description: '',
    isPublic: false,
    tierIds: [],
    tags: [],
  });
  const [errors, setErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file type and size
  const validateFile = useCallback((file: File): { isValid: boolean; error?: string } => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
    let contentType: ContentType;
    let allowedExts: string[];
    let maxSize: number;

    // Determine content type
    if (ALLOWED_EXTENSIONS.IMAGE.includes(ext)) {
      contentType = ContentType.IMAGE;
      allowedExts = ALLOWED_EXTENSIONS.IMAGE;
      maxSize = MAX_FILE_SIZES.IMAGE;
    } else if (ALLOWED_EXTENSIONS.AUDIO.includes(ext)) {
      contentType = ContentType.AUDIO;
      allowedExts = ALLOWED_EXTENSIONS.AUDIO;
      maxSize = MAX_FILE_SIZES.AUDIO;
    } else if (ALLOWED_EXTENSIONS.VIDEO.includes(ext)) {
      contentType = ContentType.VIDEO;
      allowedExts = ALLOWED_EXTENSIONS.VIDEO;
      maxSize = MAX_FILE_SIZES.VIDEO;
    } else if (ALLOWED_EXTENSIONS.DOCUMENT.includes(ext)) {
      contentType = ContentType.DOCUMENT;
      allowedExts = ALLOWED_EXTENSIONS.DOCUMENT;
      maxSize = MAX_FILE_SIZES.DOCUMENT;
    } else {
      return {
        isValid: false,
        error: 'Unsupported file type. Please upload images, audio, video, or documents.',
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large. Maximum size for ${contentType.toLowerCase()} files is ${Math.round(maxSize / 1024 / 1024)}MB.`,
      };
    }

    return { isValid: true };
  }, []);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setErrors([]);
    const newErrors: string[] = [];
    const validFiles: FilePreview[] = [];

    acceptedFiles.forEach((file) => {
      const validation = validateFile(file);
      if (validation.isValid) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        let type: ContentType;

        if (ALLOWED_EXTENSIONS.IMAGE.includes(ext)) type = ContentType.IMAGE;
        else if (ALLOWED_EXTENSIONS.AUDIO.includes(ext)) type = ContentType.AUDIO;
        else if (ALLOWED_EXTENSIONS.VIDEO.includes(ext)) type = ContentType.VIDEO;
        else type = ContentType.DOCUMENT;

        validFiles.push({
          file,
          url: URL.createObjectURL(file),
          type,
        });
      } else {
        newErrors.push(`${file.name}: ${validation.error}`);
      }
    });

    rejectedFiles.forEach(({ file, errors }) => {
      const fileErrors = errors.map((e: any) => e.message).join(', ');
      newErrors.push(`${file.name}: ${fileErrors}`);
    });

    setFiles((prev) => [...prev, ...validFiles]);
    setErrors(newErrors);

    // Auto-fill title from first file if empty
    if (validFiles.length > 0 && !metadata.title) {
      const fileName = validFiles[0].file.name.replace(/\.[^/.]+$/, '');
      setMetadata((prev) => ({ ...prev, title: fileName }));
    }
  }, [validateFile, metadata.title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || uploading,
    multiple: false, // Single file upload for now
    maxSize: Math.max(...Object.values(MAX_FILE_SIZES)),
  });

  // Remove file from list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].url);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !metadata.title.trim()) {
      setErrors(['Please select a file and provide a title']);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const filePreview = files[i];
        
        // Create metadata for this file
        const fileMetadata = {
          ...metadata,
          title: files.length === 1 ? metadata.title : `${metadata.title} ${i + 1}`,
        };

        await onUpload(filePreview.file, fileMetadata);
        
        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        setUploadProgress(progress);
        
        if (onProgress) {
          onProgress({
            loaded: i + 1,
            total: files.length,
            percentage: progress,
          });
        }
      }

      // Reset form on success
      setFiles([]);
      setMetadata({
        title: '',
        description: '',
        isPublic: false,
        tierIds: [],
        tags: [],
      });
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Upload failed']);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [files, metadata, onUpload, onProgress]);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* File Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto text-gray-400">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {isDragActive ? 'Drop your file here' : 'Upload your content'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Supported: Images (10MB), Audio (100MB), Video (500MB), Documents (50MB)
            </p>
          </div>
        </div>
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white">Selected Files</h3>
          {files.map((filePreview, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              {/* File Preview */}
              <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {filePreview.type === ContentType.IMAGE ? (
                  <img
                    src={filePreview.url}
                    alt={filePreview.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    {filePreview.type === ContentType.AUDIO && (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-2.21-.895-4.21-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 12a5.984 5.984 0 01-.757 2.828 1 1 0 11-1.415-1.656A3.989 3.989 0 0013 12a3.99 3.99 0 00-.172-1.172 1 1 0 010-1.657z" clipRule="evenodd" />
                      </svg>
                    )}
                    {filePreview.type === ContentType.VIDEO && (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4zm2 0h1V9h-1v2zm1-4V5h-1v2h1zM5 5v2H4V5h1zm0 4H4v2h1V9zm-1 4h1v2H4v-2z" clipRule="evenodd" />
                      </svg>
                    )}
                    {filePreview.type === ContentType.DOCUMENT && (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {filePreview.file.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(filePreview.file.size)} • {filePreview.type}
                </p>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => removeFile(index)}
                disabled={uploading}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Metadata Form */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white">Content Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter content title"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={metadata.description}
              onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your content"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={metadata.isPublic}
                onChange={(e) => setMetadata(prev => ({ ...prev, isPublic: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={uploading}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Make this content public (visible to all users)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Uploading...</span>
            <span className="text-gray-500 dark:text-gray-400">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Upload Errors
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading || !metadata.title.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}