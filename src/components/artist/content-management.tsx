'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MusicalNoteIcon, VideoCameraIcon, PhotoIcon, DocumentIcon } from '@heroicons/react/24/solid';
import FileUpload, { FileUploadItem } from './file-upload';

interface Content {
  id: string;
  title: string;
  description?: string;
  type: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT';
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  duration?: number;
  format: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  tiers: Array<{
    id: string;
    name: string;
  }>;
}

interface Tier {
  id: string;
  name: string;
}

interface ContentFormData {
  title: string;
  description: string;
  tags: string[];
  tierIds: string[];
  isPublic: boolean;
  thumbnailUrl?: string;
}

export default function ContentManagement() {
  const [content, setContent] = useState<Content[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadItem[]>([]);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form state
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    description: '',
    tags: [],
    tierIds: [],
    isPublic: false,
  });

  const contentTypeIcons = {
    AUDIO: MusicalNoteIcon,
    VIDEO: VideoCameraIcon,
    IMAGE: PhotoIcon,
    DOCUMENT: DocumentIcon,
  };

  useEffect(() => {
    fetchContent();
    fetchTiers();
  }, [currentPage, searchTerm, typeFilter]);

  const fetchContent = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter) params.append('type', typeFilter);

      const response = await fetch(`/api/artist/content?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data.data.content);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/artist/tiers');
      if (response.ok) {
        const data = await response.json();
        setTiers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    }
  };

  const handleFilesUploaded = (files: FileUploadItem[]) => {
    setUploadedFiles(files);
    setShowContentForm(true);
  };

  const handleCreateContent = async (fileItem: FileUploadItem) => {
    if (!fileItem.fileUrl) return;

    try {
      const response = await fetch('/api/artist/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          fileUrl: fileItem.fileUrl,
          fileSize: fileItem.file.size,
          format: fileItem.file.name.split('.').pop()?.toLowerCase() || '',
          duration: undefined, // TODO: Extract from metadata
          tags: formData.tags,
          tierIds: formData.tierIds,
          isPublic: formData.isPublic,
          thumbnailUrl: formData.thumbnailUrl,
        }),
      });

      if (response.ok) {
        fetchContent();
        resetForm();
      } else {
        const errorData = await response.json();
        alert(errorData.error?.message || 'Failed to create content');
      }
    } catch (error) {
      console.error('Failed to create content:', error);
      alert('Failed to create content');
    }
  };

  const handleUpdateContent = async () => {
    if (!editingContent) return;

    try {
      const response = await fetch(`/api/artist/content/${editingContent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          tags: formData.tags,
          tierIds: formData.tierIds,
          isPublic: formData.isPublic,
          thumbnailUrl: formData.thumbnailUrl,
        }),
      });

      if (response.ok) {
        fetchContent();
        resetForm();
      } else {
        const errorData = await response.json();
        alert(errorData.error?.message || 'Failed to update content');
      }
    } catch (error) {
      console.error('Failed to update content:', error);
      alert('Failed to update content');
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/artist/content/${contentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchContent();
      } else {
        const errorData = await response.json();
        alert(errorData.error?.message || 'Failed to delete content');
      }
    } catch (error) {
      console.error('Failed to delete content:', error);
      alert('Failed to delete content');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      tags: [],
      tierIds: [],
      isPublic: false,
    });
    setShowUpload(false);
    setShowContentForm(false);
    setEditingContent(null);
    setUploadedFiles([]);
  };

  const startEdit = (contentItem: Content) => {
    setEditingContent(contentItem);
    setFormData({
      title: contentItem.title,
      description: contentItem.description || '',
      tags: contentItem.tags,
      tierIds: contentItem.tiers.map(t => t.id),
      isPublic: contentItem.isPublic,
      thumbnailUrl: contentItem.thumbnailUrl,
    });
    setShowContentForm(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Content Management</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Upload Content</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="AUDIO">Audio</option>
            <option value="VIDEO">Video</option>
            <option value="IMAGE">Images</option>
            <option value="DOCUMENT">Documents</option>
          </select>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upload Content</h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              maxFiles={5}
            />
          </div>
        </div>
      )}

      {/* Content Form Modal */}
      {showContentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingContent ? 'Edit Content' : 'Add Content Details'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="rock, acoustic, live"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Tiers
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {tiers.map(tier => (
                    <label key={tier.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.tierIds.includes(tier.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ 
                              ...prev, 
                              tierIds: [...prev.tierIds, tier.id]
                            }));
                          } else {
                            setFormData(prev => ({ 
                              ...prev, 
                              tierIds: prev.tierIds.filter(id => id !== tier.id)
                            }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{tier.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Make this content public (accessible to all)</span>
                </label>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingContent) {
                      handleUpdateContent();
                    } else {
                      uploadedFiles.forEach(handleCreateContent);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingContent ? 'Update' : 'Create'} Content
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {content.map((item) => {
          const IconComponent = contentTypeIcons[item.type];
          
          return (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Thumbnail or Icon */}
              <div className="h-48 bg-gray-100 flex items-center justify-center">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <IconComponent className="h-16 w-16 text-gray-400" />
                )}
              </div>
              
              {/* Content Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                )}
                
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>{item.type}</span>
                  <span>{formatFileSize(item.fileSize)}</span>
                  {item.duration && <span>{formatDuration(item.duration)}</span>}
                </div>
                
                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Tiers */}
                <div className="mt-2">
                  {item.isPublic ? (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      Public
                    </span>
                  ) : item.tiers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.tiers.slice(0, 2).map(tier => (
                        <span
                          key={tier.id}
                          className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                        >
                          {tier.name}
                        </span>
                      ))}
                      {item.tiers.length > 2 && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          +{item.tiers.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">No access tiers</span>
                  )}
                </div>
                
                {/* Actions */}
                <div className="mt-3 flex justify-end space-x-2">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteContent(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          <span className="px-3 py-2 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Empty State */}
      {content.length === 0 && (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No content</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by uploading your first piece of content.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowUpload(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Upload Content
            </button>
          </div>
        </div>
      )}
    </div>
  );
}