'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Music, Video, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Progress } from './progress';

interface FileWithPreview extends File {
  preview?: string;
  id: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploadProps {
  onFileUpload?: (files: FileWithPreview[]) => Promise<void>;
  acceptedTypes?: string[];
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

const ACCEPTED_TYPES = {
  'image/*': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  'video/*': ['mp4', 'avi', 'mov', 'wmv', 'flv'],
  'audio/*': ['mp3', 'wav', 'ogg', 'aac'],
  'application/pdf': ['pdf'],
  'text/*': ['txt', 'md']
};

export function FileUpload({
  onFileUpload,
  acceptedTypes = ['image/*', 'video/*', 'audio/*'],
  maxSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 5,
  className,
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="h-8 w-8 text-purple-500" />;
    if (type.startsWith('audio/')) return <Music className="h-8 w-8 text-green-500" />;
    if (type === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}`;
    }

    // Check file type
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return 'File type not supported';
    }

    return null;
  };

  const createFileWithPreview = async (file: File): Promise<FileWithPreview> => {
    const fileWithPreview = Object.assign(file, {
      id: crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1).toString(36).substring(7),
      progress: 0,
      status: 'uploading' as const,
      preview: undefined
    });

    // Create preview for images
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          fileWithPreview.preview = e.target?.result as string;
          resolve(fileWithPreview);
        };
        reader.readAsDataURL(file);
      });
    }

    return fileWithPreview;
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (disabled || isUploading) return;

    const newFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    for (let i = 0; i < Math.min(fileList.length, maxFiles - files.length); i++) {
      const file = fileList[i];
      const error = validateFile(file);
      
      if (error) {
        errors.push(`${file.name}: ${error}`);
        continue;
      }

      const fileWithPreview = await createFileWithPreview(file);
      newFiles.push(fileWithPreview);
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      
      if (onFileUpload) {
        setIsUploading(true);
        try {
          // Simulate upload progress
          const updatedFiles = [...files, ...newFiles];
          
          for (const file of newFiles) {
            // Simulate progress updates
            for (let progress = 0; progress <= 100; progress += 10) {
              await new Promise(resolve => setTimeout(resolve, 100));
              setFiles(prev => prev.map(f => 
                f.id === file.id ? { ...f, progress } : f
              ));
            }
            
            // Mark as completed
            setFiles(prev => prev.map(f => 
              f.id === file.id ? { ...f, status: 'completed' } : f
            ));
          }
          
          await onFileUpload(updatedFiles);
        } catch (error) {
          // Mark files as error
          setFiles(prev => prev.map(f => 
            newFiles.some(nf => nf.id === f.id) 
              ? { ...f, status: 'error', error: 'Upload failed' }
              : f
          ));
        } finally {
          setIsUploading(false);
        }
      }
    }

    // Show errors if any
    if (errors.length > 0) {
      console.error('File upload errors:', errors);
    }
  }, [disabled, isUploading, files, maxFiles, onFileUpload]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ease-in-out",
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950/50",
          disabled && "cursor-not-allowed opacity-50",
          isUploading && "pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={cn(
            "p-3 rounded-full transition-colors",
            isDragOver ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragOver ? "text-blue-600" : "text-gray-600"
            )} />
          </div>
          
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isDragOver ? "Drop files here" : "Upload your files"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Max {maxFiles} files, up to {formatFileSize(maxSize)} each
            </p>
          </div>
        </div>

        {/* Upload Animation Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <div className="w-32 h-32 border-4 border-blue-500 border-dashed rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Uploaded Files ({files.length})
          </h4>
          
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {/* File Preview/Icon */}
                <div className="flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-12 w-12 object-cover rounded-md"
                    />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(file.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                    {file.error && ` • ${file.error}`}
                  </p>
                  
                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <div className="mt-2">
                      <Progress value={file.progress} className="h-1" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {file.progress}% uploaded
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}