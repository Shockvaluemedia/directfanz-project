'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { FileUploadZone } from './file-upload-zone';
import { ContentManager, ContentItem } from './content-manager';
import { 
  Upload,
  Calendar,
  Clock,
  Tag,
  Eye,
  EyeOff,
  Heart,
  ArrowUpRight,
  DollarSign,
  Settings,
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  preview?: string;
  processedUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
}

interface ContentFormData {
  title: string;
  description: string;
  visibility: 'public' | 'subscribers' | 'vip' | 'exclusive';
  isPremium: boolean;
  price?: number;
  tags: string[];
  scheduledAt?: Date;
}

export function UploadContentPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [showContentForm, setShowContentForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    description: '',
    visibility: 'public',
    isPremium: false,
    tags: [],
    scheduledAt: undefined
  });

  // Demo content for development
  useEffect(() => {
    const demoContent: ContentItem[] = [
      {
        id: '1',
        title: 'Beach Sunset Photography',
        description: 'Beautiful sunset photos from my recent trip to Malibu. Professional quality images perfect for your collection.',
        type: 'image',
        status: 'published',
        visibility: 'public',
        thumbnailUrl: 'https://picsum.photos/400/300?random=1',
        fileUrl: 'https://picsum.photos/1920/1080?random=1',
        fileSize: 2.5 * 1024 * 1024,
        dimensions: { width: 1920, height: 1080 },
        tags: ['photography', 'sunset', 'beach', 'nature'],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        views: 1250,
        likes: 89,
        comments: 23,
        earnings: 450.75,
        isPremium: false
      },
      {
        id: '2',
        title: 'Exclusive Behind-the-Scenes Video',
        description: 'Get an exclusive look at my photoshoot process. This premium content includes tips and techniques.',
        type: 'video',
        status: 'scheduled',
        visibility: 'vip',
        thumbnailUrl: 'https://picsum.photos/400/300?random=2',
        fileUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        fileSize: 15.7 * 1024 * 1024,
        duration: 180,
        dimensions: { width: 1280, height: 720 },
        tags: ['behind-the-scenes', 'tutorial', 'exclusive', 'video'],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        scheduledAt: addDays(new Date(), 1),
        views: 0,
        likes: 0,
        comments: 0,
        earnings: 0,
        isPremium: true,
        price: 19.99
      },
      {
        id: '3',
        title: 'Meditation Music Mix',
        description: 'Relaxing ambient music perfect for meditation and focus. 30-minute seamless loop.',
        type: 'audio',
        status: 'draft',
        visibility: 'subscribers',
        fileUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        fileSize: 8.2 * 1024 * 1024,
        duration: 1800,
        tags: ['music', 'meditation', 'ambient', 'relaxation'],
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        views: 0,
        likes: 0,
        comments: 0,
        earnings: 0,
        isPremium: false
      }
    ];
    setContentItems(demoContent);
  }, []);

  // Handle file uploads
  const handleFilesSelected = useCallback((files: FileList) => {
    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(2),
      file,
      progress: 0,
      status: 'uploading',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress for each file
    newFiles.forEach(uploadFile => {
      simulateUpload(uploadFile.id);
    });
  }, []);

  const simulateUpload = (fileId: string) => {
    const interval = setInterval(() => {
      setUploadedFiles(prev => prev.map(file => {
        if (file.id !== fileId) return file;
        
        if (file.progress < 90) {
          return { ...file, progress: file.progress + Math.random() * 15 };
        } else if (file.progress < 100) {
          return { ...file, progress: 100, status: 'processing' };
        } else if (file.status === 'processing') {
          // Simulate processing completion
          setTimeout(() => {
            setUploadedFiles(prev => prev.map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    status: 'completed',
                    processedUrl: f.preview || `https://example.com/processed/${fileId}`,
                    thumbnailUrl: f.preview || `https://picsum.photos/400/300?random=${fileId}`,
                    duration: f.file.type.startsWith('video/') || f.file.type.startsWith('audio/') ? 120 : undefined,
                    dimensions: f.file.type.startsWith('image/') || f.file.type.startsWith('video/') 
                      ? { width: 1920, height: 1080 } : undefined
                  }
                : f
            ));
          }, 2000);
          return file;
        }
        
        return file;
      }));
    }, 500);

    // Clear interval after completion
    setTimeout(() => clearInterval(interval), 8000);
  };

  const handleCreateContent = (uploadedFile: UploadedFile) => {
    setSelectedFile(uploadedFile);
    setFormData({
      title: uploadedFile.file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      description: '',
      visibility: 'public',
      isPremium: false,
      tags: [],
      scheduledAt: undefined
    });
    setShowContentForm(true);
  };

  const handleSubmitContent = () => {
    if (!selectedFile) return;

    const newContent: ContentItem = {
      id: Math.random().toString(36).substring(2),
      title: formData.title,
      description: formData.description,
      type: selectedFile.file.type.startsWith('image/') ? 'image' :
            selectedFile.file.type.startsWith('video/') ? 'video' :
            selectedFile.file.type.startsWith('audio/') ? 'audio' : 'document',
      status: formData.scheduledAt ? 'scheduled' : 'published',
      visibility: formData.visibility,
      thumbnailUrl: selectedFile.thumbnailUrl,
      fileUrl: selectedFile.processedUrl || selectedFile.preview || '',
      fileSize: selectedFile.file.size,
      duration: selectedFile.duration,
      dimensions: selectedFile.dimensions,
      tags: formData.tags,
      createdAt: new Date(),
      publishedAt: formData.scheduledAt ? undefined : new Date(),
      scheduledAt: formData.scheduledAt,
      views: 0,
      likes: 0,
      comments: 0,
      earnings: 0,
      isPremium: formData.isPremium,
      price: formData.price
    };

    setContentItems(prev => [newContent, ...prev]);
    
    // Remove the uploaded file from the list
    setUploadedFiles(prev => prev.filter(f => f.id !== selectedFile.id));
    
    // Reset form
    setShowContentForm(false);
    setSelectedFile(null);
    setFormData({
      title: '',
      description: '',
      visibility: 'public',
      isPremium: false,
      tags: [],
      scheduledAt: undefined
    });

    // Switch to manage tab to show the new content
    setActiveTab('manage');
  };

  const handleContentEdit = (id: string) => {
    console.log('Edit content:', id);
    // Implement edit functionality
  };

  const handleContentDelete = (id: string) => {
    setContentItems(prev => prev.filter(item => item.id !== id));
  };

  const handleContentPublish = (id: string) => {
    setContentItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'published' as const, publishedAt: new Date() } : item
    ));
  };

  const handleContentSchedule = (id: string, date: Date) => {
    setContentItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'scheduled' as const, scheduledAt: date } : item
    ));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
          <p className="text-gray-600">Upload and manage your content with advanced scheduling and organization tools</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upload')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === 'upload'
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Upload className="w-5 h-5 inline mr-2" />
              Upload Content
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === 'manage'
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Settings className="w-5 h-5 inline mr-2" />
              Manage Content ({contentItems.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* File Upload Zone */}
            <EnhancedCard variant="elevated">
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Upload New Content
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <FileUploadZone
                  onFilesSelected={handleFilesSelected}
                  maxFiles={10}
                  maxFileSize={100 * 1024 * 1024} // 100MB
                  acceptedFileTypes={{
                    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                    'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
                    'audio/*': ['.mp3', '.wav', '.aac', '.ogg'],
                    'application/pdf': ['.pdf'],
                    'application/msword': ['.doc'],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                  }}
                />
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <EnhancedCard variant="elevated">
                <EnhancedCardHeader>
                  <EnhancedCardTitle>Processing Files ({uploadedFiles.length})</EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="space-y-4">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        {/* File Preview */}
                        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          {file.preview ? (
                            <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Upload className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{file.file.name}</h4>
                          <p className="text-sm text-gray-500">
                            {(file.file.size / (1024 * 1024)).toFixed(2)} MB • {file.file.type}
                          </p>
                          
                          {/* Progress Bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600 capitalize">{file.status}</span>
                              <span className="text-gray-600">{Math.round(file.progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={cn(
                                  "h-2 rounded-full transition-all duration-300",
                                  file.status === 'completed' ? "bg-green-500" :
                                  file.status === 'error' ? "bg-red-500" :
                                  file.status === 'processing' ? "bg-yellow-500" :
                                  "bg-blue-500"
                                )}
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0">
                          {file.status === 'completed' && (
                            <EnhancedButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleCreateContent(file)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Create Content
                            </EnhancedButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            )}
          </div>
        )}

        {activeTab === 'manage' && (
          <ContentManager
            content={contentItems}
            onContentEdit={handleContentEdit}
            onContentDelete={handleContentDelete}
            onContentPublish={handleContentPublish}
            onContentSchedule={handleContentSchedule}
          />
        )}

        {/* Content Creation Modal */}
        {showContentForm && selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create Content</h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* File Preview */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedFile.preview ? (
                      <img src={selectedFile.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedFile.file.name}</h3>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter content title..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Describe your content..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Visibility
                      </label>
                      <select
                        value={formData.visibility}
                        onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="public">🌍 Public</option>
                        <option value="subscribers">❤️ Subscribers</option>
                        <option value="vip">⭐ VIP</option>
                        <option value="exclusive">🔒 Exclusive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledAt ? format(formData.scheduledAt, "yyyy-MM-dd'T'HH:mm") : ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          scheduledAt: e.target.value ? new Date(e.target.value) : undefined 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Premium Content */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPremium"
                        checked={formData.isPremium}
                        onChange={(e) => setFormData(prev => ({ ...prev, isPremium: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="isPremium" className="ml-2 text-sm font-medium text-gray-700">
                        Premium Content
                      </label>
                    </div>
                    {formData.isPremium && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <input
                          type="number"
                          value={formData.price || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                          #{tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-indigo-500 hover:text-indigo-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Add tags..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">Press Enter to add tags</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <EnhancedButton
                  variant="ghost"
                  onClick={() => setShowContentForm(false)}
                  className="flex-1"
                >
                  Cancel
                </EnhancedButton>
                <EnhancedButton
                  variant="primary"
                  onClick={handleSubmitContent}
                  disabled={!formData.title.trim()}
                  className="flex-1"
                >
                  {formData.scheduledAt ? 'Schedule Content' : 'Publish Content'}
                </EnhancedButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}