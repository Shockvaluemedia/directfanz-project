'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { EnhancedCard } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { 
  Upload, 
  X, 
  File, 
  Image, 
  Video, 
  Music, 
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadFile extends File {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string;
  thumbnail?: string;
}

interface FileUploadZoneProps {
  onFilesAdded: (files: UploadFile[]) => void;
  onFileRemoved: (fileId: string) => void;
  onUploadStart: (fileId: string) => void;
  onUploadProgress: (fileId: string, progress: number) => void;
  onUploadComplete: (fileId: string, result: any) => void;
  onUploadError: (fileId: string, error: string) => void;
  files: UploadFile[];
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  allowMultiple?: boolean;
  autoUpload?: boolean;
  className?: string;
}

const defaultAcceptedTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a',
  'application/pdf', 'text/plain'
];

export function FileUploadZone({
  onFilesAdded,
  onFileRemoved,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  files,
  maxFiles = 10,
  maxSize = 500, // MB
  acceptedTypes = defaultAcceptedTypes,
  allowMultiple = true,
  autoUpload = false,
  className
}: FileUploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const createUploadFile = useCallback((file: File): UploadFile => {
    const uploadFile = Object.assign(file, {
      id: generateFileId(),
      progress: 0,
      status: 'pending' as const,
    });

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadFile.preview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }

    return uploadFile;
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > maxSize * 1024 * 1024) {
      return { valid: false, error: `File too large. Maximum size is ${maxSize}MB` };
    }

    if (!acceptedTypes.includes(file.type)) {
      return { valid: false, error: `File type not supported: ${file.type}` };
    }

    return { valid: true };
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setIsDragActive(false);

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        console.error(`File ${file.name} rejected:`, errors);
      });
    }

    // Process accepted files
    if (acceptedFiles.length > 0) {
      const newFiles: UploadFile[] = [];
      
      acceptedFiles.forEach(file => {
        const validation = validateFile(file);
        if (validation.valid) {
          newFiles.push(createUploadFile(file));
        }
      });

      if (newFiles.length > 0) {
        onFilesAdded(newFiles);
        
        if (autoUpload) {
          newFiles.forEach(file => {
            setTimeout(() => simulateUpload(file.id), 100);
          });
        }
      }
    }
  }, [onFilesAdded, createUploadFile, maxSize, acceptedTypes, autoUpload]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: allowMultiple ? maxFiles : 1,
    multiple: allowMultiple,
    disabled: files.length >= maxFiles,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  // Simulate file upload for demo
  const simulateUpload = async (fileId: string) => {
    onUploadStart(fileId);
    
    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += Math.random() * 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        onUploadProgress(fileId, Math.min(progress, 100));
      }
      
      // Simulate successful upload
      onUploadComplete(fileId, {
        url: `/uploads/demo/${fileId}`,
        thumbnailUrl: `/uploads/demo/thumb_${fileId}`,
      });
    } catch (error) {
      onUploadError(fileId, 'Upload failed. Please try again.');
    }
  };

  const handleManualUpload = (fileId: string) => {
    simulateUpload(fileId);
  };

  const getFileIcon = (file: UploadFile) => {
    if (file.type.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (file.type.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (file.type.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (file.type === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const getStatusIcon = (file: UploadFile) => {
    switch (file.status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <EnhancedCard
        {...getRootProps()}
        variant={isDragActive || dropzoneActive ? "elevated" : "default"}
        className={cn(
          "border-2 border-dashed cursor-pointer transition-all duration-200",
          "hover:border-indigo-400 hover:bg-indigo-50",
          (isDragActive || dropzoneActive) && "border-indigo-500 bg-indigo-100",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <div className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className={cn(
              "p-3 rounded-full transition-colors",
              (isDragActive || dropzoneActive) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
            )}>
              <Upload className="w-8 h-8" />
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isDragActive ? 'Drop files here' : 'Upload your content'}
          </h3>
          
          <p className="text-gray-600 mb-4">
            Drag and drop files here, or click to browse
          </p>
          
          <div className="text-sm text-gray-500 space-y-1">
            <p>Supported: Images, Videos, Audio, Documents</p>
            <p>Maximum file size: {maxSize}MB</p>
            {allowMultiple && <p>Maximum files: {maxFiles}</p>}
          </div>
          
          <EnhancedButton
            variant="primary"
            className="mt-4"
            disabled={files.length >= maxFiles}
          >
            Choose Files
          </EnhancedButton>
        </div>
      </EnhancedCard>

      {/* File List */}
      {files.length > 0 && (
        <EnhancedCard variant="elevated">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">
                Files ({files.length}/{maxFiles})
              </h4>
              
              {!autoUpload && (
                <EnhancedButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    files
                      .filter(f => f.status === 'pending')
                      .forEach(f => handleManualUpload(f.id));
                  }}
                  disabled={!files.some(f => f.status === 'pending')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload All
                </EnhancedButton>
              )}
            </div>

            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  {/* File Preview/Icon */}
                  <div className="flex-shrink-0">
                    {file.preview ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        {getFileIcon(file)}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      {getStatusIcon(file)}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                      
                      {file.status === 'uploading' && (
                        <span className="text-sm text-blue-600">
                          {file.progress}%
                        </span>
                      )}
                      
                      {file.error && (
                        <span className="text-sm text-red-600">
                          {file.error}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {file.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!autoUpload && file.status === 'pending' && (
                      <EnhancedButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualUpload(file.id)}
                      >
                        <Play className="w-4 h-4" />
                      </EnhancedButton>
                    )}
                    
                    {file.status === 'error' && (
                      <EnhancedButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualUpload(file.id)}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </EnhancedButton>
                    )}
                    
                    <EnhancedButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onFileRemoved(file.id)}
                    >
                      <X className="w-4 h-4" />
                    </EnhancedButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </EnhancedCard>
      )}
    </div>
  );
}