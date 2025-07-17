'use client';

import { useState, useRef, useCallback } from 'react';
import { CloudArrowUpIcon, XMarkIcon, DocumentIcon, MusicalNoteIcon, VideoCameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

export interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadUrl?: string;
  fileUrl?: string;
}

interface FileUploadProps {
  onFilesUploaded: (files: FileUploadItem[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  className?: string;
}

const SUPPORTED_TYPES = {
  // Audio
  'audio/mpeg': { icon: MusicalNoteIcon, label: 'MP3 Audio' },
  'audio/wav': { icon: MusicalNoteIcon, label: 'WAV Audio' },
  'audio/flac': { icon: MusicalNoteIcon, label: 'FLAC Audio' },
  'audio/aac': { icon: MusicalNoteIcon, label: 'AAC Audio' },
  
  // Video
  'video/mp4': { icon: VideoCameraIcon, label: 'MP4 Video' },
  'video/webm': { icon: VideoCameraIcon, label: 'WebM Video' },
  'video/quicktime': { icon: VideoCameraIcon, label: 'MOV Video' },
  
  // Images
  'image/jpeg': { icon: PhotoIcon, label: 'JPEG Image' },
  'image/png': { icon: PhotoIcon, label: 'PNG Image' },
  'image/webp': { icon: PhotoIcon, label: 'WebP Image' },
  'image/gif': { icon: PhotoIcon, label: 'GIF Image' },
  
  // Documents
  'application/pdf': { icon: DocumentIcon, label: 'PDF Document' },
  'text/plain': { icon: DocumentIcon, label: 'Text Document' },
};

export default function FileUpload({
  onFilesUploaded,
  maxFiles = 10,
  acceptedTypes = Object.keys(SUPPORTED_TYPES),
  className = '',
}: FileUploadProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const typeInfo = SUPPORTED_TYPES[fileType as keyof typeof SUPPORTED_TYPES];
    return typeInfo?.icon || DocumentIcon;
  };

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }

    const typeInfo = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
    if (!typeInfo) {
      return `File type ${file.type} is not supported`;
    }

    // File size limits (in bytes)
    const sizeLimits = {
      'audio/': 100 * 1024 * 1024, // 100MB
      'video/': 500 * 1024 * 1024, // 500MB
      'image/': 10 * 1024 * 1024,  // 10MB
      'application/': 25 * 1024 * 1024, // 25MB
      'text/': 25 * 1024 * 1024, // 25MB
    };

    const category = Object.keys(sizeLimits).find(key => file.type.startsWith(key));
    const limit = category ? sizeLimits[category as keyof typeof sizeLimits] : 25 * 1024 * 1024;

    if (file.size > limit) {
      const limitMB = limit / (1024 * 1024);
      return `File size exceeds limit of ${limitMB}MB`;
    }

    return null;
  };

  const uploadFile = async (fileItem: FileUploadItem): Promise<void> => {
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));

      // Get presigned URL
      const response = await fetch('/api/artist/content/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileItem.file.name,
          fileType: fileItem.file.type,
          fileSize: fileItem.file.size,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get upload URL');
      }

      const { data } = await response.json();
      const { uploadUrl, fileUrl } = data;

      // Upload file to S3 with progress tracking
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id ? { ...f, progress } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id 
                ? { ...f, status: 'completed' as const, progress: 100, fileUrl, uploadUrl }
                : f
            ));
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', fileItem.file.type);
        xhr.send(fileItem.file);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'error' as const, error: errorMessage }
          : f
      ));
      throw error;
    }
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: FileUploadItem[] = [];
    
    for (let i = 0; i < fileList.length && newFiles.length + files.length < maxFiles; i++) {
      const file = fileList[i];
      const validationError = validateFile(file);
      
      const fileItem: FileUploadItem = {
        id: generateFileId(),
        file,
        progress: 0,
        status: validationError ? 'error' : 'pending',
        error: validationError || undefined,
      };
      
      newFiles.push(fileItem);
    }

    setFiles(prev => [...prev, ...newFiles]);

    // Start uploading valid files
    const validFiles = newFiles.filter(f => f.status === 'pending');
    for (const fileItem of validFiles) {
      try {
        await uploadFile(fileItem);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    // Notify parent component of completed uploads
    const completedFiles = files.concat(newFiles).filter(f => f.status === 'completed');
    if (completedFiles.length > 0) {
      onFilesUploaded(completedFiles);
    }
  }, [files, maxFiles, onFilesUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const retryUpload = async (fileId: string) => {
    const fileItem = files.find(f => f.id === fileId);
    if (fileItem && fileItem.status === 'error') {
      try {
        await uploadFile(fileItem);
        const completedFiles = files.filter(f => f.status === 'completed');
        if (completedFiles.length > 0) {
          onFilesUploaded(completedFiles);
        }
      } catch (error) {
        console.error('Retry upload error:', error);
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Audio, Video, Images, or Documents up to various size limits
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Files ({files.length}/{maxFiles})
          </h4>
          
          <div className="space-y-2">
            {files.map((fileItem) => {
              const FileIcon = getFileIcon(fileItem.file.type);
              
              return (
                <div
                  key={fileItem.id}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                    
                    {/* Progress Bar */}
                    {fileItem.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${fileItem.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {fileItem.progress}% uploaded
                        </p>
                      </div>
                    )}
                    
                    {/* Error Message */}
                    {fileItem.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">
                        {fileItem.error}
                      </p>
                    )}
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center space-x-2">
                    {fileItem.status === 'completed' && (
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                    )}
                    {fileItem.status === 'error' && (
                      <button
                        onClick={() => retryUpload(fileItem.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Retry
                      </button>
                    )}
                    
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}