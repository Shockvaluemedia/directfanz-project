'use client';

import { useState, useRef } from 'react';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useFileUpload } from '@/hooks/use-file-upload';

export default function FileUpload() {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploads, uploadMultipleFiles, clearUpload } = useFileUpload();

  const handleFiles = async (fileList: FileList) => {
    try {
      await uploadMultipleFiles(Array.from(fileList));
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Content</h3>
        
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
            Audio files (MP3, WAV, FLAC), Videos (MP4, WebM), Images (JPG, PNG), Documents (PDF)
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,video/*,image/*,application/pdf,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        
        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Uploads ({uploads.length})
            </h4>
            
            <div className="space-y-3">
              {uploads.map((upload) => (
                <div
                  key={upload.fileName}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {upload.fileName}
                    </p>
                    
                    {upload.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {upload.progress}% uploaded
                        </p>
                      </div>
                    )}
                    
                    {upload.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">
                        {upload.error}
                      </p>
                    )}
                    
                    {upload.status === 'completed' && (
                      <p className="text-xs text-green-600 mt-1">
                        Upload completed
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {upload.status === 'completed' && (
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                    )}
                    {upload.status === 'error' && (
                      <div className="h-2 w-2 bg-red-500 rounded-full" />
                    )}
                    {upload.status === 'uploading' && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                    
                    <button
                      onClick={() => clearUpload(upload.fileName)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}