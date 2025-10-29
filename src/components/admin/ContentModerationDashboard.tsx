'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Flag,
  Users,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Calendar,
  Download,
  RefreshCw,
  Play,
  Pause,
  MoreHorizontal,
  FileText,
  Image,
  Video,
  Music,
  AlertOctagon,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  User,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ModerationStats {
  totalContent: number;
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
  averageProcessingTime: number;
  approvalRate: number;
  aiAccuracy: number;
}

interface PendingContent {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  uploadedAt: string;
  fileSize: number;
  moderation: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    flags: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      confidence: number;
    }>;
    recommendations: string[];
  };
  thumbnailUrl?: string;
  priority: number;
}

interface ModerationFilter {
  status: 'all' | 'pending' | 'flagged' | 'approved' | 'rejected';
  riskLevel: 'all' | 'low' | 'medium' | 'high' | 'critical';
  contentType: 'all' | 'image' | 'video' | 'audio' | 'document';
  timeframe: 'today' | 'week' | 'month' | 'all';
}

export function ContentModerationDashboard() {
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [pendingContent, setPendingContent] = useState<PendingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContent, setSelectedContent] = useState<PendingContent[]>([]);
  const [filter, setFilter] = useState<ModerationFilter>({
    status: 'pending',
    riskLevel: 'all',
    contentType: 'all',
    timeframe: 'today'
  });

  useEffect(() => {
    fetchModerationData();
  }, [filter]);

  const fetchModerationData = async () => {
    try {
      setRefreshing(true);
      
      // Fetch moderation stats and pending content
      const [statsResponse, contentResponse] = await Promise.all([
        fetch('/api/admin/content/moderation?action=stats'),
        fetch(`/api/admin/content/moderation?action=pending&limit=20&offset=0`)
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data || mockStats);
      }

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        setPendingContent(contentData.data?.content || mockPendingContent);
      }

    } catch (error) {
      console.error('Failed to fetch moderation data:', error);
      setStats(mockStats);
      setPendingContent(mockPendingContent);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'flag', reason?: string) => {
    if (selectedContent.length === 0) return;

    try {
      const contentIds = selectedContent.map(c => c.id);
      
      const response = await fetch('/api/admin/content/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          contentIds,
          reason
        })
      });

      if (response.ok) {
        setSelectedContent([]);
        await fetchModerationData(); // Refresh data
      }
    } catch (error) {
      console.error(`Failed to ${action} content:`, error);
    }
  };

  const handleContentAction = async (content: PendingContent, action: 'approve' | 'reject' | 'flag', reason?: string) => {
    try {
      const response = await fetch('/api/admin/content/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          contentIds: [content.id],
          reason
        })
      });

      if (response.ok) {
        await fetchModerationData(); // Refresh data
      }
    } catch (error) {
      console.error(`Failed to ${action} content:`, error);
    }
  };

  const toggleContentSelection = (content: PendingContent) => {
    setSelectedContent(prev => {
      const isSelected = prev.some(c => c.id === content.id);
      if (isSelected) {
        return prev.filter(c => c.id !== content.id);
      } else {
        return [...prev, content];
      }
    });
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-300';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-green-600 bg-green-100 border-green-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Loading Moderation Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            Content Moderation
          </h1>
          <p className="text-gray-600 mt-1">AI-powered content review and moderation system</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={fetchModerationData}
            disabled={refreshing}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Requires attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approvalRate}%</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-green-500 mt-2">+2.3% this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Accuracy</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.aiAccuracy}%</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-blue-500 mt-2">High confidence</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Process Time</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.averageProcessingTime}s</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-purple-500 mt-2">-0.3s faster</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search content..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select 
                value={filter.riskLevel}
                onChange={(e) => setFilter({...filter, riskLevel: e.target.value as any})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select 
                value={filter.contentType}
                onChange={(e) => setFilter({...filter, contentType: e.target.value as any})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="document">Documents</option>
              </select>
            </div>

            {selectedContent.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedContent.length} selected
                </span>
                <Button
                  onClick={() => handleBulkAction('approve')}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve All
                </Button>
                <Button
                  onClick={() => handleBulkAction('reject', 'Bulk rejection')}
                  size="sm"
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject All
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Content List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Flag className="w-5 h-5 mr-2" />
            Content Awaiting Review ({pendingContent.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingContent.map((content) => (
              <motion.div
                key={content.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-lg p-4 transition-all ${
                  selectedContent.some(c => c.id === content.id) 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-4">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedContent.some(c => c.id === content.id)}
                    onChange={() => toggleContentSelection(content)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  {/* Content Preview */}
                  <div className="flex-shrink-0">
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt="Content thumbnail"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                        {getContentTypeIcon(content.type)}
                      </div>
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{content.title}</h3>
                      <Badge className={`border ${getRiskLevelColor(content.moderation.riskLevel)}`}>
                        {content.moderation.riskLevel.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{content.artistName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getContentTypeIcon(content.type)}
                        <span className="capitalize">{content.type}</span>
                      </div>
                      <span>{formatFileSize(content.fileSize)}</span>
                      <span>{new Date(content.uploadedAt).toLocaleDateString()}</span>
                    </div>

                    {/* AI Flags */}
                    {content.moderation.flags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">AI Detected Issues:</p>
                        <div className="flex flex-wrap gap-2">
                          {content.moderation.flags.map((flag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className={`text-xs ${getRiskLevelColor(flag.severity)}`}
                            >
                              {flag.type}: {flag.description}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Recommendations */}
                    {content.moderation.recommendations.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">AI Recommendations:</p>
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {content.moderation.recommendations.slice(0, 2).map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>AI Confidence: {Math.round(content.moderation.confidence * 100)}%</span>
                        <span>•</span>
                        <span>Priority: {content.priority}/10</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => handleContentAction(content, 'approve')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleContentAction(content, 'reject', 'Content violates community guidelines')}
                          size="sm"
                          variant="destructive"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleContentAction(content, 'flag', 'Requires further review')}
                          size="sm"
                          variant="outline"
                        >
                          <Flag className="w-4 h-4 mr-1" />
                          Flag
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {pendingContent.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No content pending review</h3>
                <p className="text-gray-600">All content has been processed by our AI moderation system.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data
const mockStats: ModerationStats = {
  totalContent: 12847,
  pending: 23,
  approved: 12456,
  rejected: 368,
  flagged: 89,
  averageProcessingTime: 2.3,
  approvalRate: 94.2,
  aiAccuracy: 97.8
};

const mockPendingContent: PendingContent[] = [
  {
    id: '1',
    title: 'Fitness workout routine video',
    artistName: 'Sarah Johnson',
    artistId: 'artist-1',
    type: 'video',
    uploadedAt: new Date().toISOString(),
    fileSize: 45678900,
    priority: 7,
    moderation: {
      riskLevel: 'medium',
      confidence: 0.87,
      flags: [
        {
          type: 'inappropriate_text',
          severity: 'medium',
          description: 'Potentially inappropriate language detected',
          confidence: 0.82
        }
      ],
      recommendations: [
        'Review audio content for inappropriate language',
        'Consider age-restricting if confirmed'
      ]
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    title: 'Digital art collection showcase',
    artistName: 'Alex Chen',
    artistId: 'artist-2',
    type: 'image',
    uploadedAt: new Date(Date.now() - 300000).toISOString(),
    fileSize: 2345678,
    priority: 4,
    moderation: {
      riskLevel: 'low',
      confidence: 0.95,
      flags: [],
      recommendations: [
        'Content appears safe for publication',
        'No issues detected'
      ]
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    title: 'Controversial political commentary',
    artistName: 'Mike Roberts',
    artistId: 'artist-3',
    type: 'audio',
    uploadedAt: new Date(Date.now() - 600000).toISOString(),
    fileSize: 15678900,
    priority: 9,
    moderation: {
      riskLevel: 'high',
      confidence: 0.91,
      flags: [
        {
          type: 'hate_speech',
          severity: 'high',
          description: 'Potential hate speech detected',
          confidence: 0.89
        },
        {
          type: 'harassment',
          severity: 'medium',
          description: 'Possible harassment content',
          confidence: 0.73
        }
      ],
      recommendations: [
        'Manual review required before approval',
        'Consider content warning or age restriction',
        'Review against community guidelines'
      ]
    }
  }
];