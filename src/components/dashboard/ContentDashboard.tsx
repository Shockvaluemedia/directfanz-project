'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Play, 
  Pause, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Edit, 
  Trash2, 
  Upload,
  Filter,
  Search,
  Calendar,
  TrendingUp,
  Users,
  DollarSign
} from 'lucide-react';
import { ContentAnalyticsChart } from './ContentAnalyticsChart';
import { ContentEditor } from './ContentEditor';
import { FileUpload } from '../content/FileUpload';

interface Content {
  id: string;
  title: string;
  description?: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  visibility: 'PUBLIC' | 'TIER_LOCKED' | 'PRIVATE';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  totalViews: number;
  uniqueViews: number;
  lastViewedAt?: string;
  tiers: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface Analytics {
  totalViews: number;
  uniqueViews: number;
  totalContent: number;
  avgViewsPerContent: number;
  topContent: Content[];
  viewsOverTime: {
    date: string;
    views: number;
    uniqueViews: number;
  }[];
}

export function ContentDashboard() {
  const [content, setContent] = useState<Content[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchContent();
    fetchAnalytics();
  }, [typeFilter, visibilityFilter, sortBy, sortOrder, searchTerm]);

  const fetchContent = async () => {
    try {
      const params = new URLSearchParams({
        type: typeFilter !== 'all' ? typeFilter : '',
        visibility: visibilityFilter !== 'all' ? visibilityFilter : '',
        sortBy,
        sortOrder,
        search: searchTerm,
        limit: '50'
      });

      const response = await fetch(`/api/content?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data.content);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/content/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setContent(content.filter(c => c.id !== contentId));
        fetchAnalytics(); // Refresh analytics
      }
    } catch (error) {
      console.error('Failed to delete content:', error);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'audio':
        return <Play className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    const variants = {
      PUBLIC: 'default',
      TIER_LOCKED: 'secondary',
      PRIVATE: 'outline'
    } as const;

    return (
      <Badge variant={variants[visibility as keyof typeof variants]}>
        {visibility.replace('_', ' ')}
      </Badge>
    );
  };

  const filteredContent = content.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Dashboard</h1>
          <p className="text-muted-foreground">Manage your content and track performance</p>
        </div>
        <Button onClick={() => setShowUploader(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Content
        </Button>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Views</span>
              </div>
              <div className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Unique Viewers</span>
              </div>
              <div className="text-2xl font-bold">{analytics.uniqueViews.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Content</span>
              </div>
              <div className="text-2xl font-bold">{analytics.totalContent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Avg Views</span>
              </div>
              <div className="text-2xl font-bold">{Math.round(analytics.avgViewsPerContent)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <Input
                    placeholder="Search content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="TIER_LOCKED">Tier Locked</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Date Created</SelectItem>
                    <SelectItem value="totalViews">Total Views</SelectItem>
                    <SelectItem value="uniqueViews">Unique Views</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {item.thumbnailUrl ? (
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {getContentIcon(item.type)}
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getVisibilityBadge(item.visibility)}
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold line-clamp-2">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Eye className="h-3 w-3" />
                          <span>{item.totalViews}</span>
                        </span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedContent(item);
                          setShowEditor(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContent(item.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredContent.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No content found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || typeFilter !== 'all' || visibilityFilter !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Get started by uploading your first piece of content.'
                  }
                </p>
                <Button onClick={() => setShowUploader(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Content
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          {analytics && (
            <ContentAnalyticsChart 
              data={analytics.viewsOverTime}
              topContent={analytics.topContent}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload New Content</DialogTitle>
          </DialogHeader>
          <FileUpload
            onUploadComplete={() => {
              setShowUploader(false);
              fetchContent();
              fetchAnalytics();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
          </DialogHeader>
          {selectedContent && (
            <ContentEditor
              content={selectedContent}
              onSave={() => {
                setShowEditor(false);
                setSelectedContent(null);
                fetchContent();
              }}
              onCancel={() => {
                setShowEditor(false);
                setSelectedContent(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}