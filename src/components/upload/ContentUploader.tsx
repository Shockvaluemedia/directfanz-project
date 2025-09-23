'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  MusicalNoteIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FolderPlusIcon,
  EyeIcon,
  TagIcon,
  Cog6ToothIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlaySolid, PauseIcon as PauseSolid } from '@heroicons/react/24/solid';
import { SUPPORTED_FILE_TYPES, FILE_SIZE_LIMITS } from '@/lib/s3';
import Image from 'next/image';

interface FileUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  preview?: string;
  metadata?: ContentMetadata;
  duration?: number;
  dimensions?: { width: number; height: number };
}

interface ContentMetadata {
  title: string;
  description: string;
  tags: string[];
  category: 'MUSIC' | 'VIDEO' | 'IMAGE' | 'TUTORIAL' | 'PODCAST' | 'OTHER';
  visibility: 'PUBLIC' | 'PRIVATE' | 'TIER_LOCKED';
  tierIds: string[];
  scheduledAt?: Date;
  allowComments: boolean;
  allowDownload: boolean;
  isExclusive: boolean;
  contentWarning?: string;
}

const INITIAL_METADATA: ContentMetadata = {
  title: '',
  description: '',
  tags: [],
  category: 'OTHER',
  visibility: 'PRIVATE',
  tierIds: [],
  allowComments: true,
  allowDownload: false,
  isExclusive: false,
};

const CATEGORIES = [
  { id: 'MUSIC', name: 'Music & Audio', icon: MusicalNoteIcon, color: 'purple' },
  { id: 'VIDEO', name: 'Video Content', icon: VideoCameraIcon, color: 'blue' },
  { id: 'IMAGE', name: 'Photos & Art', icon: PhotoIcon, color: 'green' },
  { id: 'TUTORIAL', name: 'Tutorial & Education', icon: DocumentIcon, color: 'orange' },
  { id: 'PODCAST', name: 'Podcast & Talk', icon: MusicalNoteIcon, color: 'red' },
  { id: 'OTHER', name: 'Other Content', icon: FolderPlusIcon, color: 'gray' },
];

export default function ContentUploader() {
  const { data: session } = useSession();
  const router = useRouter();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [globalMetadata, setGlobalMetadata] = useState<ContentMetadata>(INITIAL_METADATA);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewFile, setPreviewFile] = useState<FileUpload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return PhotoIcon;
    if (fileType.startsWith('video/')) return VideoCameraIcon;
    if (fileType.startsWith('audio/')) return MusicalNoteIcon;
    return DocumentIcon;
  };

  const getFileCategory = (fileType: string) => {
    const fileInfo = SUPPORTED_FILE_TYPES[fileType as keyof typeof SUPPORTED_FILE_TYPES];
    return fileInfo?.category || 'UNKNOWN';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      return `Unsupported file type: ${file.type}`;
    }

    const fileInfo = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    const sizeLimit = FILE_SIZE_LIMITS[fileInfo.category];

    // Check file size
    if (file.size > sizeLimit) {
      const limitMB = sizeLimit / (1024 * 1024);
      return `File size exceeds ${limitMB}MB limit for ${fileInfo.category} files`;
    }

    return null;
  };

  // Generate preview for files
  const generatePreview = useCallback(async (file: File): Promise<{ preview?: string; duration?: number; dimensions?: { width: number; height: number } }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const img = new window.Image();
        
        reader.onload = (e) => {
          const result = e.target?.result as string;
          img.onload = () => {
            resolve({ 
              preview: result, 
              dimensions: { width: img.width, height: img.height } 
            });
          };
          img.onerror = () => resolve({});
          img.src = result;
        };
        reader.onerror = () => resolve({});
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadeddata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          video.currentTime = Math.min(2, video.duration / 4); // Thumbnail at 25% or 2 seconds
        };
        
        video.onseeked = () => {
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const preview = canvas.toDataURL('image/jpeg', 0.8);
            resolve({ 
              preview, 
              duration: video.duration,
              dimensions: { width: video.videoWidth, height: video.videoHeight }
            });
          } else {
            resolve({ duration: video.duration });
          }
        };
        
        video.onerror = () => resolve({});
        video.src = URL.createObjectURL(file);
        video.load();
      } else if (file.type.startsWith('audio/')) {
        const audio = new Audio();
        audio.onloadeddata = () => {
          resolve({ duration: audio.duration });
        };
        audio.onerror = () => resolve({});
        audio.src = URL.createObjectURL(file);
        audio.load();
      } else {
        resolve({});
      }
    });
  }, []);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newUploads: FileUpload[] = [];

    for (const file of Array.from(files)) {
      const validationError = validateFile(file);
      const previewData = validationError ? {} : await generatePreview(file);
      
      const upload: FileUpload = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: validationError ? 'error' : 'pending',
        progress: 0,
        error: validationError || undefined,
        metadata: { ...INITIAL_METADATA },
        ...previewData,
      };

      newUploads.push(upload);
    }

    setUploads(prev => [...prev, ...newUploads]);
  }, [generatePreview]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id));
  };

  const uploadFile = async (upload: FileUpload) => {
    try {
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      const useLocalStorage = process.env.NEXT_PUBLIC_USE_LOCAL_STORAGE === 'true';

      if (useLocalStorage) {
        // Local development upload
        const formData = new FormData();
        formData.append('file', upload.file);

        const uploadResponse = await fetch('/api/upload/local', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload failed');
        }

        const uploadResult = await uploadResponse.json();

        setUploads(prev => prev.map(u => 
          u.id === upload.id 
            ? { 
                ...u, 
                status: 'success', 
                progress: 100,
                fileUrl: uploadResult.data.fileUrl 
              } 
            : u
        ));
      } else {
        // S3 upload flow
        // First, get presigned URL
        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, progress: 20 } : u
        ));

        const presignedResponse = await fetch('/api/upload/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: upload.file.name,
            fileType: upload.file.type,
            fileSize: upload.file.size,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { data: presignedData } = await presignedResponse.json();

        // Upload to S3
        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, progress: 50 } : u
        ));

        const s3Response = await fetch(presignedData.uploadUrl, {
          method: 'PUT',
          body: upload.file,
          headers: {
            'Content-Type': upload.file.type,
          },
        });

        if (!s3Response.ok) {
          throw new Error('S3 upload failed');
        }

        setUploads(prev => prev.map(u => 
          u.id === upload.id 
            ? { 
                ...u, 
                status: 'success', 
                progress: 100,
                fileUrl: presignedData.fileUrl 
              } 
            : u
        ));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { 
              ...u, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            } 
          : u
      ));
    }
  };

  const uploadAll = () => {
    uploads
      .filter(upload => upload.status === 'pending')
      .forEach(uploadFile);
  };

  const openMetadataForm = (uploadId: string) => {
    setCurrentUploadId(uploadId);
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      setMetadata({
        ...INITIAL_METADATA,
        title: upload.file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      });
    }
    setShowMetadataForm(true);
  };

  const submitContent = async () => {
    if (!currentUploadId) return;

    const upload = uploads.find(u => u.id === currentUploadId);
    if (!upload || !upload.fileUrl) return;

    setIsSubmitting(true);

    try {
      const fileInfo = SUPPORTED_FILE_TYPES[upload.file.type as keyof typeof SUPPORTED_FILE_TYPES];
      
      const response = await fetch('/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: metadata.title,
          description: metadata.description,
          fileUrl: upload.fileUrl,
          fileSize: upload.file.size,
          format: fileInfo?.extension || 'unknown',
          tags: metadata.tags,
          visibility: metadata.visibility,
          tierIds: metadata.tierIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create content');
      }

      // Success! Reset and redirect
      setShowMetadataForm(false);
      setMetadata(INITIAL_METADATA);
      setCurrentUploadId(null);
      
      // Remove the uploaded file from the list
      setUploads(prev => prev.filter(u => u.id !== currentUploadId));
      
      // Redirect to content management
      router.push('/dashboard/artist/content');
    } catch (error) {
      console.error('Content creation error:', error);
      alert('Failed to create content. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (session?.user?.role !== 'ARTIST') {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">Only artists can upload content.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragActive
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CloudArrowUpIcon className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          Upload your content
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to browse
        </p>
        
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Choose Files
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(SUPPORTED_FILE_TYPES).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Supported formats */}
        <div className="mt-6 text-xs text-gray-500">
          <p className="font-medium">Supported formats:</p>
          <p className="mt-1">
            Images (JPEG, PNG, WebP, GIF), Videos (MP4, WebM, MOV), 
            Audio (MP3, WAV, FLAC, AAC), Documents (PDF, TXT)
          </p>
        </div>
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Files ({uploads.length})
            </h3>
            {uploads.some(u => u.status === 'pending') && (
              <button
                onClick={uploadAll}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Upload All
              </button>
            )}
          </div>

          <div className="space-y-3">
            {uploads.map((upload) => {
              const Icon = getFileIcon(upload.file.type);
              return (
                <div
                  key={upload.id}
                  className="flex items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                >
                  <Icon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                  
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {upload.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(upload.file.size)} • {getFileCategory(upload.file.type)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {upload.status === 'success' && (
                          <button
                            onClick={() => openMetadataForm(upload.id)}
                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                          >
                            Publish
                          </button>
                        )}
                        
                        {upload.status === 'pending' && (
                          <button
                            onClick={() => uploadFile(upload)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          >
                            Upload
                          </button>
                        )}
                        
                        <button
                          onClick={() => removeUpload(upload.id)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {upload.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Uploading...</span>
                          <span>{upload.progress}%</span>
                        </div>
                        <div className="mt-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Status Messages */}
                    {upload.status === 'success' && (
                      <div className="mt-2 flex items-center text-green-600">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        <span className="text-xs">Upload complete</span>
                      </div>
                    )}
                    
                    {upload.status === 'error' && (
                      <div className="mt-2 flex items-center text-red-600">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        <span className="text-xs">{upload.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata Form Modal */}
      {showMetadataForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowMetadataForm(false)} />
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Publish Content</h3>
                <button
                  onClick={() => setShowMetadataForm(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter content title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe your content..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visibility
                  </label>
                  <select
                    value={metadata.visibility}
                    onChange={(e) => setMetadata(prev => ({ 
                      ...prev, 
                      visibility: e.target.value as 'PUBLIC' | 'PRIVATE' | 'TIER_LOCKED' 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PRIVATE">Private (Only you)</option>
                    <option value="PUBLIC">Public (Everyone)</option>
                    <option value="TIER_LOCKED">Tier Locked (Subscribers only)</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => setShowMetadataForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitContent}
                  disabled={!metadata.title || isSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}