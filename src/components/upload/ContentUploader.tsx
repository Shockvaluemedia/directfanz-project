'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  CloudArrowUpIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  FolderPlusIcon,
  EyeIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { getPresignedUrl, uploadFileWithProgress, validateFile, formatFileSize } from '@/lib/upload-utils';

interface FileUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
  error?: string;
  preview?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
}

interface ContentMetadata {
  title: string;
  description: string;
  category: string;
  tags: string[];
  visibility: 'PUBLIC' | 'SUBSCRIBERS' | 'PREMIUM';
  price?: number;
  scheduledFor?: string;
  allowComments: boolean;
  allowDownload: boolean;
  isExclusive: boolean;
  contentWarning: boolean;
  notifySubscribers: boolean;
}

const ContentUploader: React.FC = () => {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileUpload | null>(null);
  
  const [metadata, setMetadata] = useState<ContentMetadata>({
    title: '',
    description: '',
    category: '',
    tags: [],
    visibility: 'PUBLIC',
    allowComments: true,
    allowDownload: false,
    isExclusive: false,
    contentWarning: false,
    notifySubscribers: true,
  });

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  // File handling
  const handleFiles = async (files: File[]) => {
    const newUploads: FileUpload[] = [];

    for (const file of files) {
      const id = Math.random().toString(36).substring(2, 15);
      const previewData = await generatePreview(file);
      
      newUploads.push({
        id,
        file,
        status: 'pending',
        progress: 0,
        ...previewData,
      });
    }

    setUploads(prev => [...prev, ...newUploads]);
  };

  const uploadFile = async (upload: FileUpload) => {
    setUploads(prev => 
      prev.map(u => 
        u.id === upload.id ? { ...u, status: 'uploading', progress: 0 } : u
      )
    );

    try {
      // Get presigned URL from server
      const presignedResponse = await getPresignedUrl({
        fileName: upload.file.name,
        fileType: upload.file.type,
        fileSize: upload.file.size,
      });

      // Upload file with progress tracking
      const fileUrl = await uploadFileWithProgress(
        upload.file,
        presignedResponse.data,
        (progress) => {
          setUploads(prev => 
            prev.map(u => 
              u.id === upload.id ? { ...u, progress } : u
            )
          );
        }
      );

      setUploads(prev => 
        prev.map(u => 
          u.id === upload.id 
            ? { ...u, status: 'success', progress: 100, url: fileUrl } 
            : u
        )
      );
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploads(prev => 
        prev.map(u => 
          u.id === upload.id 
            ? { ...u, status: 'error', error: errorMessage } 
            : u
        )
      );
    }
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
    setSelectedUploads(prev => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  };

  const uploadAll = () => {
    uploads
      .filter(u => u.status === 'pending')
      .forEach(upload => uploadFile(upload));
  };

  const toggleSelection = (id: string) => {
    setSelectedUploads(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const selectAll = () => {
    if (selectedUploads.size === uploads.length) {
      setSelectedUploads(new Set());
    } else {
      setSelectedUploads(new Set(uploads.map(u => u.id)));
    }
  };

  const deleteSelected = () => {
    const selectedIds = Array.from(selectedUploads);
    setUploads(prev => prev.filter(u => !selectedIds.includes(u.id)));
    setSelectedUploads(new Set());
  };

  const openMetadataModal = (uploadId: string | null = null) => {
    setCurrentUploadId(uploadId);
    setMetadataModalOpen(true);
  };

  const closeMetadataModal = () => {
    setMetadataModalOpen(false);
    setCurrentUploadId(null);
    setMetadata({
      title: '',
      description: '',
      category: '',
      tags: [],
      visibility: 'PUBLIC',
      allowComments: true,
      allowDownload: false,
      isExclusive: false,
      contentWarning: false,
      notifySubscribers: true,
    });
  };

  const submitContent = async (publish: boolean = true) => {
    if (!currentUploadId) {
      console.error('No upload selected for publishing');
      return;
    }

    const upload = uploads.find(u => u.id === currentUploadId);
    if (!upload || !upload.url) {
      console.error('Upload not found or no URL available');
      return;
    }

    try {
      // Prepare content data for API
      const contentData = {
        title: metadata.title,
        description: metadata.description,
        type: determineContentType(upload.file),
        fileUrl: upload.url,
        thumbnailUrl: upload.preview,
        visibility: metadata.visibility === 'SUBSCRIBERS' ? 'SUBSCRIBERS_ONLY' : metadata.visibility,
        fileSize: upload.file.size,
        format: upload.file.type,
        tags: metadata.tags.join(','),
        category: metadata.category,
        allowComments: metadata.allowComments,
        allowDownloads: metadata.allowDownload,
        matureContent: metadata.contentWarning,
        isPremium: metadata.visibility === 'PREMIUM',
        price: metadata.price,
      };

      // Submit to API
      const response = await fetch('/api/content/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contentData),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to publish content' }));
        throw new Error(error.error || 'Failed to publish content');
      }

      const result = await response.json();

      // Mark upload as published and remove from list
      setUploads(prev => prev.filter(u => u.id !== currentUploadId));
      
      // Show success message (you might want to add a toast notification here)
      console.log('Content published successfully:', result.data);
      
      closeMetadataModal();
    } catch (error) {
      console.error('Failed to publish content:', error);
      // You might want to show an error message to the user here
      alert(error instanceof Error ? error.message : 'Failed to publish content');
    }
  };

  const determineContentType = (file: File): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' => {
    const type = file.type.toLowerCase();
    if (type.startsWith('image/')) return 'IMAGE';
    if (type.startsWith('video/')) return 'VIDEO';
    if (type.startsWith('audio/')) return 'AUDIO';
    return 'DOCUMENT';
  };

  const removeTag = (index: number) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const currentUpload = currentUploadId 
    ? uploads.find(u => u.id === currentUploadId) 
    : null;

  // Role-based access
  if ((session?.user as any)?.role !== 'ARTIST') {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">Only artists can upload content.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Upload Zone */}
      <div className="relative">
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6">
            <CloudArrowUpIcon className="h-12 w-12 text-white" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Upload Your Content
          </h3>
          <p className="text-gray-600 mb-8 text-lg">
            Drag and drop your files here, or click to browse
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <FolderPlusIcon className="h-5 w-5 mr-2" />
              Choose Files
            </button>
            
            {uploads.length > 0 && (
              <button
                onClick={() => openMetadataModal()}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Batch Settings
              </button>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            className="hidden"
          />
          
          {/* Supported Formats */}
          <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
              Supported Formats
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <PhotoIcon className="h-4 w-4 text-green-500" />
                <span className="font-medium text-gray-700">Images</span>
              </div>
              <div className="text-xs text-gray-500">
                JPG, PNG, GIF, WebP<br />
                Max: 50MB
              </div>
              
              <div className="flex items-center space-x-2">
                <VideoCameraIcon className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-gray-700">Videos</span>
              </div>
              <div className="text-xs text-gray-500">
                MP4, MOV, AVI, WebM<br />
                Max: 2GB
              </div>
              
              <div className="flex items-center space-x-2">
                <MusicalNoteIcon className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-gray-700">Audio</span>
              </div>
              <div className="text-xs text-gray-500">
                MP3, WAV, FLAC, AAC<br />
                Max: 100MB
              </div>
              
              <div className="flex items-center space-x-2">
                <DocumentIcon className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-gray-700">Documents</span>
              </div>
              <div className="text-xs text-gray-500">
                PDF, DOC, TXT<br />
                Max: 25MB
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File List */}
      {uploads.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with Controls */}
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FolderPlusIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Files ({uploads.length})
                </h3>
                
                {batchMode && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={selectAll}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedUploads.size === uploads.length ? 'Deselect All' : 'Select All'}
                    </button>
                    
                    {selectedUploads.size > 0 && (
                      <>
                        <span className="text-sm text-gray-500">|</span>
                        <span className="text-sm text-gray-600">{selectedUploads.size} selected</span>
                        <button
                          onClick={deleteSelected}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete Selected
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {uploads.some(u => u.status === 'pending') && (
                  <button
                    onClick={uploadAll}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                    Upload All
                  </button>
                )}
                
                <button
                  onClick={() => setBatchMode(!batchMode)}
                  className={`inline-flex items-center px-3 py-2 rounded-lg font-medium transition-colors ${
                    batchMode
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Batch Mode
                </button>
                
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${
                      viewMode === 'grid'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-white text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${
                      viewMode === 'list'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-white text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Grid/List View */}
          <div className="p-6">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {uploads.map((upload) => {
                  const Icon = getFileIcon(upload.file.type);
                  const isSelected = selectedUploads.has(upload.id);
                  
                  return (
                    <div
                      key={upload.id}
                      className={`relative group bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                        isSelected 
                          ? 'border-blue-500 shadow-md' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      {batchMode && (
                        <div className="absolute top-3 left-3 z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(upload.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      
                      {/* File Info */}
                      <div className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <Icon className="h-8 w-8 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
                              {upload.file.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(upload.file.size)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Upload Progress */}
                        {upload.status === 'uploading' && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Uploading...</span>
                              <span>{upload.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Status Messages */}
                        {upload.status === 'success' && (
                          <div className="flex items-center text-green-600 text-xs mb-3">
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            <span>Upload complete</span>
                          </div>
                        )}
                        
                        {upload.status === 'error' && (
                          <div className="flex items-center text-red-600 text-xs mb-3">
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            <span>{upload.error}</span>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {upload.status === 'success' && (
                            <button
                              onClick={() => openMetadataModal(upload.id)}
                              className="flex-1 bg-blue-600 text-white text-xs py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                              Publish
                            </button>
                          )}
                          
                          {upload.status === 'pending' && (
                            <button
                              onClick={() => uploadFile(upload)}
                              className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                              Upload
                            </button>
                          )}
                          
                          <button
                            onClick={() => removeUpload(upload.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => {
                  const Icon = getFileIcon(upload.file.type);
                  const isSelected = selectedUploads.has(upload.id);
                  
                  return (
                    <div
                      key={upload.id}
                      className={`flex items-center p-4 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {batchMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(upload.id)}
                          className="mr-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                      
                      <Icon className="h-8 w-8 text-gray-400 flex-shrink-0 mr-4" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="font-semibold text-gray-900 truncate text-sm">
                              {upload.file.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatFileSize(upload.file.size)}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {upload.status === 'success' && (
                              <button
                                onClick={() => openMetadataModal(upload.id)}
                                className="bg-blue-600 text-white text-xs py-1.5 px-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                              >
                                Publish
                              </button>
                            )}
                            
                            {upload.status === 'pending' && (
                              <button
                                onClick={() => uploadFile(upload)}
                                className="bg-green-600 text-white text-xs py-1.5 px-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                              >
                                Upload
                              </button>
                            )}
                            
                            <button
                              onClick={() => removeUpload(upload.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Progress Bar for List View */}
                        {upload.status === 'uploading' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Uploading...</span>
                              <span>{upload.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Status Messages for List View */}
                        {upload.status === 'success' && (
                          <div className="flex items-center text-green-600 text-xs mt-2">
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            <span>Upload complete</span>
                          </div>
                        )}
                        
                        {upload.status === 'error' && (
                          <div className="flex items-center text-red-600 text-xs mt-2">
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            <span>{upload.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata Modal */}
      {metadataModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Content Details</h2>
                <button
                  onClick={closeMetadataModal}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={metadata.title}
                      onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                      placeholder="Enter content title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={metadata.category}
                      onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      <option value="PHOTOS">Photos</option>
                      <option value="VIDEOS">Videos</option>
                      <option value="AUDIO">Audio</option>
                      <option value="EXCLUSIVE">Exclusive Content</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                    placeholder="Tell your fans about this content..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
              
              {/* Privacy & Access */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Privacy & Access
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <select
                      value={metadata.visibility}
                      onChange={(e) => setMetadata({ ...metadata, visibility: e.target.value as 'PUBLIC' | 'SUBSCRIBERS' | 'PREMIUM' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="SUBSCRIBERS">Subscribers Only</option>
                      <option value="PREMIUM">Premium Subscribers</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (if premium)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={metadata.price || ''}
                        onChange={(e) => setMetadata({ ...metadata, price: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowComments"
                      checked={metadata.allowComments}
                      onChange={(e) => setMetadata({ ...metadata, allowComments: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="allowComments" className="ml-2 text-sm text-gray-700">
                      Allow comments
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowDownload"
                      checked={metadata.allowDownload}
                      onChange={(e) => setMetadata({ ...metadata, allowDownload: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="allowDownload" className="ml-2 text-sm text-gray-700">
                      Allow downloads
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="contentWarning"
                      checked={metadata.contentWarning}
                      onChange={(e) => setMetadata({ ...metadata, contentWarning: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="contentWarning" className="ml-2 text-sm text-gray-700">
                      Mature content (18+)
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
              <div className="flex justify-between space-x-3">
                <button
                  onClick={closeMetadataModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => submitContent(false)}
                    className="px-6 py-2 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Save as Draft
                  </button>
                  
                  <button
                    onClick={() => submitContent(true)}
                    disabled={!metadata.title || !metadata.category}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Publish Content
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility Functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return PhotoIcon;
  if (fileType.startsWith('video/')) return VideoCameraIcon;
  if (fileType.startsWith('audio/')) return MusicalNoteIcon;
  return DocumentIcon;
};

const generatePreview = async (file: File): Promise<{ preview?: string; dimensions?: { width: number; height: number }; duration?: number }> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        resolve({
          preview: url,
          dimensions: { width: img.width, height: img.height }
        });
      };
      
      img.onerror = () => resolve({});
      img.src = url;
    } else {
      resolve({});
    }
  });
};

export default ContentUploader;