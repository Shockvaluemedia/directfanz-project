'use client';

import React, { useState, useMemo } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle, EnhancedCardDescription } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { 
  Calendar, 
  Clock, 
  Eye, 
  EyeOff, 
  Edit3, 
  Trash2, 
  Tag, 
  Filter,
  Search,
  Grid,
  List,
  Image,
  Video,
  Music,
  File,
  MoreVertical,
  Share2,
  Download,
  Heart,
  MessageCircle,
  Play,
  Pause,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'audio' | 'document';
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  visibility: 'public' | 'subscribers' | 'vip' | 'exclusive';
  thumbnailUrl?: string;
  fileUrl: string;
  fileSize: number;
  duration?: number; // for video/audio in seconds
  dimensions?: { width: number; height: number }; // for images/videos
  tags: string[];
  createdAt: Date;
  publishedAt?: Date;
  scheduledAt?: Date;
  views: number;
  likes: number;
  comments: number;
  earnings: number;
  isPremium: boolean;
  price?: number;
}

interface ContentManagerProps {
  content: ContentItem[];
  onContentEdit: (id: string) => void;
  onContentDelete: (id: string) => void;
  onContentPublish: (id: string) => void;
  onContentSchedule: (id: string, date: Date) => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'image' | 'video' | 'audio' | 'document';
type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published' | 'archived';
type SortBy = 'newest' | 'oldest' | 'most-viewed' | 'highest-earning';

export function ContentManager({
  content,
  onContentEdit,
  onContentDelete,
  onContentPublish,
  onContentSchedule,
  className
}: ContentManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let filtered = [...content];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        selectedTags.some(tag => item.tags.includes(tag))
      );
    }

    // Sort content
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'most-viewed':
          return b.views - a.views;
        case 'highest-earning':
          return b.earnings - a.earnings;
        case 'newest':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    return filtered;
  }, [content, filterType, statusFilter, searchQuery, selectedTags, sortBy]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    content.forEach(item => {
      item.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [content]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: content.length,
      published: content.filter(c => c.status === 'published').length,
      scheduled: content.filter(c => c.status === 'scheduled').length,
      drafts: content.filter(c => c.status === 'draft').length,
      totalViews: content.reduce((sum, c) => sum + c.views, 0),
      totalEarnings: content.reduce((sum, c) => sum + c.earnings, 0),
    };
  }, [content]);

  const getTypeIcon = (type: ContentItem['type']) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'document': return <File className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: ContentItem['status']) => {
    switch (status) {
      case 'published': return 'text-green-600 bg-green-100';
      case 'scheduled': return 'text-blue-600 bg-blue-100';
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'archived': return 'text-red-600 bg-red-100';
    }
  };

  const getVisibilityIcon = (visibility: ContentItem['visibility']) => {
    switch (visibility) {
      case 'public': return <Eye className="w-3 h-3" />;
      case 'subscribers': return <Heart className="w-3 h-3" />;
      case 'vip': return <ArrowUpRight className="w-3 h-3" />;
      case 'exclusive': return <EyeOff className="w-3 h-3" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScheduleDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d, yyyy');
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
          <div className="text-sm text-blue-600">Total Content</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-700">{stats.published}</div>
          <div className="text-sm text-green-600">Published</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
          <div className="text-2xl font-bold text-orange-700">{stats.scheduled}</div>
          <div className="text-sm text-orange-600">Scheduled</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-700">{stats.drafts}</div>
          <div className="text-sm text-gray-600">Drafts</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <div className="text-2xl font-bold text-purple-700">{stats.totalViews.toLocaleString()}</div>
          <div className="text-sm text-purple-600">Total Views</div>
        </div>
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700">${stats.totalEarnings.toLocaleString()}</div>
          <div className="text-sm text-emerald-600">Earnings</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <EnhancedCard variant="elevated">
        <EnhancedCardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                  <option value="document">Documents</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Drafts</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="most-viewed">Most Viewed</option>
                  <option value="highest-earning">Highest Earning</option>
                </select>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <EnhancedButton
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </EnhancedButton>
                <EnhancedButton
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </EnhancedButton>
              </div>
            </div>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 font-medium mr-2">Tags:</span>
                {allTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                      selectedTags.includes(tag)
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    #{tag}
                  </button>
                ))}
                {allTags.length > 10 && (
                  <span className="text-sm text-gray-500">+{allTags.length - 10} more</span>
                )}
              </div>
            </div>
          )}
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Content Grid/List */}
      {filteredContent.length === 0 ? (
        <EnhancedCard>
          <EnhancedCardContent className="p-12 text-center">
            <File className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No content found</h3>
            <p className="text-gray-500">Try adjusting your filters or search terms</p>
          </EnhancedCardContent>
        </EnhancedCard>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredContent.map(item => (
            <ContentCard key={item.id} item={item} onEdit={onContentEdit} onDelete={onContentDelete} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContent.map(item => (
            <ContentListItem key={item.id} item={item} onEdit={onContentEdit} onDelete={onContentDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// Content Card Component for Grid View
function ContentCard({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: ContentItem; 
  onEdit: (id: string) => void; 
  onDelete: (id: string) => void; 
}) {
  return (
    <EnhancedCard variant="elevated" className="group hover:shadow-lg transition-all duration-200">
      <div className="relative">
        {/* Thumbnail */}
        <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {item.type === 'image' && <Image className="w-12 h-12 text-gray-400" />}
              {item.type === 'video' && <Video className="w-12 h-12 text-gray-400" />}
              {item.type === 'audio' && <Music className="w-12 h-12 text-gray-400" />}
              {item.type === 'document' && <File className="w-12 h-12 text-gray-400" />}
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <span className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            item.status === 'published' && "bg-green-100 text-green-700",
            item.status === 'scheduled' && "bg-blue-100 text-blue-700",
            item.status === 'draft' && "bg-gray-100 text-gray-700",
            item.status === 'archived' && "bg-red-100 text-red-700"
          )}>
            {item.status}
          </span>
        </div>

        {/* Premium Badge */}
        {item.isPremium && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
              Premium
            </span>
          </div>
        )}

        {/* Duration for video/audio */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>

      <EnhancedCardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 truncate flex-1" title={item.title}>
            {item.title}
          </h3>
          <div className="flex items-center gap-1 ml-2">
            {item.type === 'image' && <Image className="w-4 h-4 text-gray-500" />}
            {item.type === 'video' && <Video className="w-4 h-4 text-gray-500" />}
            {item.type === 'audio' && <Music className="w-4 h-4 text-gray-500" />}
            {item.type === 'document' && <File className="w-4 h-4 text-gray-500" />}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.slice(0, 2).map(tag => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                #{tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="text-xs text-gray-500">+{item.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {item.views}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {item.likes}
            </span>
          </div>
          <span className="font-semibold text-green-600">
            ${item.earnings}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <EnhancedButton variant="ghost" size="sm" onClick={() => onEdit(item.id)} className="flex-1">
            <Edit3 className="w-4 h-4 mr-1" />
            Edit
          </EnhancedButton>
          <EnhancedButton variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
            <Trash2 className="w-4 h-4" />
          </EnhancedButton>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Content List Item Component for List View
function ContentListItem({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: ContentItem; 
  onEdit: (id: string) => void; 
  onDelete: (id: string) => void; 
}) {
  return (
    <EnhancedCard variant="elevated" className="hover:shadow-md transition-shadow duration-200">
      <EnhancedCardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="w-20 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {item.type === 'image' && <Image className="w-6 h-6 text-gray-400" />}
                {item.type === 'video' && <Video className="w-6 h-6 text-gray-400" />}
                {item.type === 'audio' && <Music className="w-6 h-6 text-gray-400" />}
                {item.type === 'document' && <File className="w-6 h-6 text-gray-400" />}
              </div>
            )}
          </div>

          {/* Content Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                item.status === 'published' && "bg-green-100 text-green-700",
                item.status === 'scheduled' && "bg-blue-100 text-blue-700",
                item.status === 'draft' && "bg-gray-100 text-gray-700",
                item.status === 'archived' && "bg-red-100 text-red-700"
              )}>
                {item.status}
              </span>
              {item.isPremium && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  Premium
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate mb-2">{item.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {item.views}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {item.likes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {item.comments}
              </span>
              <span className="text-green-600 font-semibold">
                ${item.earnings}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <EnhancedButton variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
              <Edit3 className="w-4 h-4" />
            </EnhancedButton>
            <EnhancedButton variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
              <Trash2 className="w-4 h-4" />
            </EnhancedButton>
            <EnhancedButton variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </EnhancedButton>
          </div>
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}