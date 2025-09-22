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
  CogIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SUPPORTED_FILE_TYPES, FILE_SIZE_LIMITS } from '@/lib/s3';

interface FileUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'optimizing' | 'success' | 'error';
  progress: number;
  error?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  optimization?: {
    strategy: string;
    analysis?: any;
    result?: any;
  };
}

interface ContentMetadata {
  title: string;
  description: string;
  tags: string[];
  visibility: 'PUBLIC' | 'PRIVATE' | 'TIER_LOCKED';
  tierIds: string[];
  enableOptimization: boolean;
  optimizationStrategy: string;
  targetDevice: string;
  targetConnection: string;
}

const INITIAL_METADATA: ContentMetadata = {
  title: '',
  description: '',
  tags: [],
  visibility: 'PRIVATE',
  tierIds: [],
  enableOptimization: true,
  optimizationStrategy: 'auto',
  targetDevice: 'desktop',
  targetConnection: 'wifi',
};

const OPTIMIZATION_STRATEGIES = [
  { key: 'auto', name: 'Auto (Recommended)', description: 'AI-powered optimization based on content analysis' },
  { key: 'quality', name: 'Quality First', description: 'Preserve maximum quality with minimal compression' },
  { key: 'balanced', name: 'Balanced', description: 'Good balance between file size and quality' },
  { key: 'size', name: 'Size Optimized', description: 'Maximum compression for smallest file size' },
  { key: 'mobile', name: 'Mobile Optimized', description: 'Optimized for mobile devices and slower connections' },
  { key: 'streaming', name: 'Streaming Optimized', description: 'Optimized for video/audio streaming' },
];

const TARGET_DEVICES = [
  { key: 'mobile', name: 'Mobile', icon: '📱' },
  { key: 'tablet', name: 'Tablet', icon: '📱' },
  { key: 'desktop', name: 'Desktop', icon: '💻' },
  { key: 'tv', name: 'TV', icon: '📺' },
];

const CONNECTION_TYPES = [
  { key: '2g', name: '2G', icon: '🐌' },
  { key: '3g', name: '3G', icon: '🚶' },
  { key: '4g', name: '4G/LTE', icon: '🏃' },
  { key: '5g', name: '5G', icon: '🚀' },
  { key: 'wifi', name: 'Wi-Fi', icon: '📶' },
];

export default function OptimizedContentUploader() {
  const { data: session } = useSession();
  const router = useRouter();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [metadata, setMetadata] = useState<ContentMetadata>(INITIAL_METADATA);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [showOptimizationSettings, setShowOptimizationSettings] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableStrategies, setAvailableStrategies] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available optimization strategies
  useEffect(() => {
    loadOptimizationStrategies();
  }, []);

  const loadOptimizationStrategies = async () => {
    try {
      const response = await fetch('/api/content/optimize?action=strategies');
      if (response.ok) {
        const data = await response.json();
        setAvailableStrategies(data.data.strategies);
      }
    } catch (error) {
      console.error('Failed to load optimization strategies:', error);
      setAvailableStrategies(OPTIMIZATION_STRATEGIES);
    }
  };

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
    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      return `Unsupported file type: ${file.type}`;
    }

    const fileInfo = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    const sizeLimit = FILE_SIZE_LIMITS[fileInfo.category];

    if (file.size > sizeLimit) {
      const limitMB = sizeLimit / (1024 * 1024);
      return `File size exceeds ${limitMB}MB limit for ${fileInfo.category} files`;
    }

    return null;
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newUploads: FileUpload[] = [];

    Array.from(files).forEach(file => {
      const validationError = validateFile(file);
      
      const upload: FileUpload = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: validationError ? 'error' : 'pending',
        progress: 0,
        error: validationError || undefined,
        optimization: {
          strategy: metadata.optimizationStrategy,
        },
      };

      newUploads.push(upload);
    });

    setUploads(prev => [...prev, ...newUploads]);
  }, [metadata.optimizationStrategy]);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const uploadFile = async (upload: FileUpload) => {
    try {
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'uploading', progress: 10 } : u
      ));

      // Step 1: Get presigned URL for upload
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

      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, progress: 30 } : u
      ));

      // Step 2: Upload to S3
      const s3Response = await fetch(presignedData.uploadUrl, {
        method: 'PUT',
        body: upload.file,
        headers: { 'Content-Type': upload.file.type },
      });

      if (!s3Response.ok) {
        throw new Error('S3 upload failed');
      }

      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, progress: 60, fileUrl: presignedData.fileUrl } : u
      ));

      // Step 3: Apply optimization if enabled
      if (metadata.enableOptimization) {
        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, status: 'optimizing', progress: 70 } : u
        ));

        try {
          const optimizationResponse = await fetch('/api/content/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: presignedData.fileUrl,
              contentType: getFileCategory(upload.file.type),
              strategy: metadata.optimizationStrategy,
              targetDevice: metadata.targetDevice,
              targetConnection: metadata.targetConnection,
            }),
          });

          if (optimizationResponse.ok) {
            const optimizationData = await optimizationResponse.json();
            
            setUploads(prev => prev.map(u => 
              u.id === upload.id 
                ? { 
                    ...u, 
                    optimization: {
                      ...u.optimization,
                      result: optimizationData.data,
                    }
                  }
                : u
            ));
          }
        } catch (optimizationError) {
          console.warn('Optimization failed, continuing with original file:', optimizationError);
        }
      }

      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { 
              ...u, 
              status: 'success', 
              progress: 100,
            } 
          : u
      ));
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

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id));
  };

  const openMetadataForm = (uploadId: string) => {
    setCurrentUploadId(uploadId);
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      setMetadata({
        ...INITIAL_METADATA,
        title: upload.file.name.replace(/\.[^/.]+$/, ''),
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
          optimization: upload.optimization,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create content');
      }

      setShowMetadataForm(false);
      setMetadata(INITIAL_METADATA);
      setCurrentUploadId(null);
      setUploads(prev => prev.filter(u => u.id !== currentUploadId));
      
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
        
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Choose Files
          </button>
          <button
            onClick={() => setShowOptimizationSettings(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <CogIcon className="h-4 w-4 mr-2" />
            Optimization Settings
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

        {/* Optimization Status */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center text-sm text-gray-600">
            <SparklesIcon className="h-4 w-4 mr-2" />
            Smart Optimization: {metadata.enableOptimization ? 'Enabled' : 'Disabled'} • 
            Strategy: {OPTIMIZATION_STRATEGIES.find(s => s.key === metadata.optimizationStrategy)?.name}
          </div>
        </div>
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="mt-8">
          <div className="space-y-3">
            {uploads.map((upload) => {
              const Icon = getFileIcon(upload.file.type);
              const hasOptimization = upload.optimization?.result;
              
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
                        
                        {/* Optimization Results */}
                        {hasOptimization && (
                          <div className="mt-1 text-xs text-green-600">
                            ✨ Optimized: {hasOptimization.sizeReduction.toFixed(1)}% smaller, 
                            Quality: {hasOptimization.qualityScore}/100
                          </div>
                        )}
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
                    {(upload.status === 'uploading' || upload.status === 'optimizing') && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            {upload.status === 'uploading' ? 'Uploading...' : 'Optimizing...'}
                          </span>
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
                        <span className="text-xs">Ready to publish</span>
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

      {/* Optimization Settings Modal */}
      {showOptimizationSettings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowOptimizationSettings(false)} />
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Optimization Settings</h3>
                <button
                  onClick={() => setShowOptimizationSettings(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={metadata.enableOptimization}
                      onChange={(e) => setMetadata(prev => ({ ...prev, enableOptimization: e.target.checked }))}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-900">Enable Smart Optimization</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Automatically optimize content for better performance and smaller file sizes
                  </p>
                </div>

                {metadata.enableOptimization && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Optimization Strategy
                      </label>
                      <select
                        value={metadata.optimizationStrategy}
                        onChange={(e) => setMetadata(prev => ({ ...prev, optimizationStrategy: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {OPTIMIZATION_STRATEGIES.map((strategy) => (
                          <option key={strategy.key} value={strategy.key}>
                            {strategy.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {OPTIMIZATION_STRATEGIES.find(s => s.key === metadata.optimizationStrategy)?.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Target Device
                        </label>
                        <select
                          value={metadata.targetDevice}
                          onChange={(e) => setMetadata(prev => ({ ...prev, targetDevice: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {TARGET_DEVICES.map((device) => (
                            <option key={device.key} value={device.key}>
                              {device.icon} {device.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Connection Type
                        </label>
                        <select
                          value={metadata.targetConnection}
                          onChange={(e) => setMetadata(prev => ({ ...prev, targetConnection: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {CONNECTION_TYPES.map((connection) => (
                            <option key={connection.key} value={connection.key}>
                              {connection.icon} {connection.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowOptimizationSettings(false)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Form Modal (existing implementation with optimization data) */}
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