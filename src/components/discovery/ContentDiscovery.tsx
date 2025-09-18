'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search,
  Filter,
  Play,
  Eye,
  Heart,
  Clock,
  TrendingUp,
  Star,
  Grid,
  List,
  ChevronDown
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  visibility: 'PUBLIC' | 'TIER_LOCKED' | 'PRIVATE';
  tags: string[];
  createdAt: string;
  totalViews: number;
  likes: number;
  artist: {
    id: string;
    name: string;
    profileImage?: string;
  };
  tiers?: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface Filters {
  search: string;
  type: string;
  artist: string;
  tag: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function ContentDiscovery() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [featuredContent, setFeaturedContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('explore');
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: 'all',
    artist: '',
    tag: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [popularArtists, setPopularArtists] = useState<{ id: string; name: string; contentCount: number }[]>([]);

  useEffect(() => {
    fetchContent();
    fetchFeaturedContent();
    fetchMetadata();
  }, [filters]);

  const fetchContent = async () => {
    try {
      const params = new URLSearchParams({
        search: filters.search,
        type: filters.type !== 'all' ? filters.type : '',
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: '20',
        visibility: 'PUBLIC' // Only show public content in discovery
      });

      const response = await fetch(`/api/content/discover?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data.content || []);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    }
  };

  const fetchFeaturedContent = async () => {
    try {
      const response = await fetch('/api/content/featured');
      if (response.ok) {
        const data = await response.json();
        setFeaturedContent(data.content || []);
      }
    } catch (error) {
      console.error('Failed to fetch featured content:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const response = await fetch('/api/content/metadata');
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
        setPopularArtists(data.artists || []);
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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

  const ContentCard = ({ item, featured = false }: { item: ContentItem; featured?: boolean }) => (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group ${featured ? 'border-primary' : ''}`}>
      <Link href={`/content/${item.id}`}>
        <div className="aspect-video bg-muted relative">
          {item.thumbnailUrl ? (
            <img 
              src={item.thumbnailUrl} 
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              {getContentIcon(item.type)}
            </div>
          )}
          
          {/* Content Type Badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="capitalize">
              {item.type}
            </Badge>
          </div>
          
          {/* Tier Badge */}
          {item.visibility === 'TIER_LOCKED' && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                <Star className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            </div>
          )}
          
          {featured && (
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-primary">
                <TrendingUp className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}
        </div>
      </Link>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-grow min-w-0">
            <Link href={`/content/${item.id}`}>
              <h3 className="font-semibold hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </h3>
            </Link>
            <Link href={`/artist/${item.artist.id}`}>
              <p className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {item.artist.name}
              </p>
            </Link>
          </div>
          
          <div className="flex-shrink-0 ml-2">
            {item.artist.profileImage ? (
              <img 
                src={item.artist.profileImage} 
                alt={item.artist.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-semibold">
                  {item.artist.name[0]}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {item.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <Eye className="h-3 w-3" />
              <span>{item.totalViews.toLocaleString()}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Heart className="h-3 w-3" />
              <span>{item.likes}</span>
            </span>
          </div>
          <span className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const ContentList = ({ item }: { item: ContentItem }) => (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <Link href={`/content/${item.id}`} className="flex-shrink-0">
            <div className="w-24 h-16 bg-muted rounded overflow-hidden">
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
            </div>
          </Link>
          
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <Link href={`/content/${item.id}`}>
                  <h3 className="font-semibold hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                </Link>
                <Link href={`/artist/${item.artist.id}`}>
                  <p className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {item.artist.name}
                  </p>
                </Link>
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                    {item.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-muted-foreground ml-4">
                <span className="flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>{item.totalViews.toLocaleString()}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Heart className="h-3 w-3" />
                  <span>{item.likes}</span>
                </span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Discover Content</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="explore">Explore</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
        </TabsList>

        <TabsContent value="explore" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2 flex-grow">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                
                <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Latest</SelectItem>
                    <SelectItem value="totalViews">Most Viewed</SelectItem>
                    <SelectItem value="likes">Most Liked</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Content Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {content.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {content.map((item) => (
                <ContentList key={item.id} item={item} />
              ))}
            </div>
          )}

          {content.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No content found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trending">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {content
              .sort((a, b) => b.totalViews - a.totalViews)
              .slice(0, 12)
              .map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="featured">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredContent.map((item) => (
              <ContentCard key={item.id} item={item} featured={true} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}