'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  FileText, 
  Video, 
  Image, 
  Music,
  Eye,
  Heart,
  MessageSquare,
  TrendingUp,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Upload,
  Filter,
  Search,
  MoreHorizontal,
  Play,
  Download,
  Share
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  type: 'image' | 'video' | 'audio' | 'text';
  status: 'published' | 'draft' | 'pending' | 'archived';
  thumbnail?: string;
  views: number;
  likes: number;
  comments: number;
  revenue: number;
  publishedAt: string;
  updatedAt: string;
  description: string;
  tags: string[];
  isExclusive: boolean;
  price: number;
}

interface ContentStats {
  totalContent: number;
  totalViews: number;
  totalRevenue: number;
  publishedCount: number;
  draftCount: number;
  pendingCount: number;
}

export default function ContentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // Check if user is creator (in real app, would check role)
    const userRole = (session.user as any)?.role;
    if (userRole !== 'ARTIST' && userRole !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    loadContent();
  }, [session, status, router]);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call - in real app, this would fetch user's content
      const mockContent: ContentItem[] = [
        {
          id: '1',
          title: 'Behind the Scenes: Studio Session',
          type: 'video',
          status: 'published',
          thumbnail: '/placeholder-video.jpg',
          views: 2340,
          likes: 189,
          comments: 23,
          revenue: 150.75,
          publishedAt: '2024-09-20T10:00:00Z',
          updatedAt: '2024-09-20T10:00:00Z',
          description: 'Exclusive look at my creative process in the studio',
          tags: ['music', 'studio', 'behind-scenes'],
          isExclusive: true,
          price: 9.99
        },
        {
          id: '2',
          title: 'Morning Inspiration',
          type: 'image',
          status: 'published',
          views: 1890,
          likes: 245,
          comments: 12,
          revenue: 89.50,
          publishedAt: '2024-09-19T08:30:00Z',
          updatedAt: '2024-09-19T08:30:00Z',
          description: 'Captured this beautiful sunrise during my morning routine',
          tags: ['inspiration', 'morning', 'photography'],
          isExclusive: false,
          price: 0
        },
        {
          id: '3',
          title: 'Unreleased Track Preview',
          type: 'audio',
          status: 'draft',
          views: 0,
          likes: 0,
          comments: 0,
          revenue: 0,
          publishedAt: '',
          updatedAt: '2024-09-21T14:20:00Z',
          description: 'First listen to my upcoming single',
          tags: ['music', 'unreleased', 'preview'],
          isExclusive: true,
          price: 4.99
        },
        {
          id: '4',
          title: 'Q&A Session',
          type: 'text',
          status: 'pending',
          views: 0,
          likes: 0,
          comments: 0,
          revenue: 0,
          publishedAt: '',
          updatedAt: '2024-09-21T12:00:00Z',
          description: 'Answering your most asked questions',
          tags: ['qa', 'fans', 'interaction'],
          isExclusive: false,
          price: 0
        }
      ];

      const mockStats: ContentStats = {
        totalContent: mockContent.length,
        totalViews: mockContent.reduce((sum, item) => sum + item.views, 0),
        totalRevenue: mockContent.reduce((sum, item) => sum + item.revenue, 0),
        publishedCount: mockContent.filter(item => item.status === 'published').length,
        draftCount: mockContent.filter(item => item.status === 'draft').length,
        pendingCount: mockContent.filter(item => item.status === 'pending').length,
      };

      setContent(mockContent);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!session || !stats) {
    return null;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'image': return Image;
      case 'audio': return Music;
      case 'text': return FileText;
      default: return FileText;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'published': return `${baseClasses} bg-green-100 text-green-800`;
      case 'draft': return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'pending': return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'archived': return `${baseClasses} bg-red-100 text-red-800`;
      default: return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not published';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const filteredContent = content.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter;
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
            <p className="text-gray-600">Manage and track your published content</p>
          </div>
          <Button onClick={() => router.push('/upload')} className="flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Create Content
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Content</p>
                <p className="text-2xl font-bold">{stats.totalContent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Published</p>
                <p className="text-2xl font-bold">{stats.publishedCount}</p>
                <p className="text-xs text-gray-500">
                  {stats.draftCount} drafts, {stats.pendingCount} pending
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Content</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="pending">Pending</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6">
        {filteredContent.map((item) => {
          const TypeIcon = getTypeIcon(item.type);
          
          return (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <TypeIcon className="w-8 h-8 text-gray-500" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <span className={getStatusBadge(item.status)}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                        {item.isExclusive && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Exclusive
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Eye className="w-4 h-4 text-gray-500 mr-1" />
                          <span className="text-sm font-semibold">{item.views.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500">Views</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Heart className="w-4 h-4 text-gray-500 mr-1" />
                          <span className="text-sm font-semibold">{item.likes}</span>
                        </div>
                        <p className="text-xs text-gray-500">Likes</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <MessageSquare className="w-4 h-4 text-gray-500 mr-1" />
                          <span className="text-sm font-semibold">{item.comments}</span>
                        </div>
                        <p className="text-xs text-gray-500">Comments</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="w-4 h-4 text-gray-500 mr-1" />
                          <span className="text-sm font-semibold">{formatCurrency(item.revenue)}</span>
                        </div>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Calendar className="w-4 h-4 text-gray-500 mr-1" />
                          <span className="text-sm font-semibold">{formatDate(item.publishedAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500">Published</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-2">
                        {item.price > 0 && (
                          <span className="text-sm text-gray-600">
                            Price: {formatCurrency(item.price)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          <Share className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredContent.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No content found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filter !== 'all' 
                  ? 'No content matches your current filters.' 
                  : "You haven't created any content yet."}
              </p>
              {!searchTerm && filter === 'all' && (
                <Button onClick={() => router.push('/upload')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Your First Content
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}