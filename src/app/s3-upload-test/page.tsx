'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Upload, 
  File, 
  Image, 
  Video, 
  Music,
  CheckCircle, 
  AlertCircle, 
  X,
  Download,
  Eye
} from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
}

export default function S3UploadTestPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const fileId = `file-${Date.now()}-${Math.random()}`;
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        url: '',
        status: 'uploading',
        progress: 0
      };

      setUploadedFiles(prev => [...prev, newFile]);
      simulateUpload(fileId);
    });
  };

  const simulateUpload = (fileId: string) => {
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadedFiles(prev => prev.map(file => {
        if (file.id === fileId) {
          const newProgress = Math.min(file.progress + Math.random() * 30, 100);
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return {
              ...file,
              progress: 100,
              status: Math.random() > 0.1 ? 'success' : 'error',
              url: file.status === 'success' ? `https://demo-bucket.s3.amazonaws.com/${file.name}` : ''
            };
          }
          return { ...file, progress: newProgress };
        }
        return file;
      }));
    }, 200);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const clearAll = () => {
    setUploadedFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    return File;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">S3 Upload Test</h1>
        <p className="text-gray-600">
          Test file uploads to Amazon S3. This is a development and testing interface.
        </p>
      </div>

      {/* Upload Area */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files here or click to select files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">
              Drop files here to upload
            </p>
            <p className="text-gray-600 mb-4">
              or click to select files from your computer
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="file-input"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <label htmlFor="file-input">
              <Button className="cursor-pointer">
                Select Files
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress & Results */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upload Progress</CardTitle>
                <CardDescription>
                  {uploadedFiles.length} file(s) selected
                </CardDescription>
              </div>
              <Button onClick={clearAll} variant="outline" size="sm">
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((file) => {
                const FileIcon = getFileIcon(file.type);
                
                return (
                  <div
                    key={file.id}
                    className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                      </p>
                      
                      {/* Progress Bar */}
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {Math.round(file.progress)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {file.status === 'uploading' && (
                        <LoadingSpinner size="sm" />
                      )}
                      
                      {file.status === 'success' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </>
                      )}
                      
                      {file.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      
                      <Button
                        onClick={() => removeFile(file.id)}
                        size="sm"
                        variant="ghost"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Test Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <strong>Purpose:</strong> This page simulates S3 file uploads for testing purposes.
              In a production environment, this would connect to your actual AWS S3 bucket.
            </div>
            
            <div>
              <strong>Supported Files:</strong> Images, videos, audio files, PDFs, and documents.
            </div>
            
            <div>
              <strong>Features:</strong>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Drag and drop file upload</li>
                <li>Multiple file selection</li>
                <li>Upload progress tracking</li>
                <li>Error handling simulation</li>
                <li>File type detection</li>
              </ul>
            </div>
            
            <div>
              <strong>Note:</strong> This is a demo interface. Files are not actually uploaded
              to any server. The upload progress is simulated for testing purposes.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}