'use client';

import React from 'react';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { ImageViewer } from './ImageViewer';
import { ContentAccessControl } from './ContentAccessControl';
import { CommentSystem } from '../comments/CommentSystem';

interface ContentViewerProps {
  contentId: string;
  className?: string;
  onSubscribe?: (tierId: string) => void;
}

interface ContentData {
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
  tiers: {
    id: string;
    name: string;
    price: number;
    description?: string;
  }[];
  artist: {
    id: string;
    name: string;
    profileImage?: string;
  };
  likes?: number;
  hasLiked?: boolean;
  commentsCount?: number;
}

export function ContentViewer({ contentId, className, onSubscribe }: ContentViewerProps) {
  const [content, setContent] = React.useState<ContentData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchContent();
  }, [contentId]);

  const fetchContent = async () => {
    try {
      const response = await fetch(`/api/content/${contentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }
      const data = await response.json();
      setContent(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderMediaPlayer = (hasAccess: boolean, content: ContentData) => {
    if (!hasAccess) return null;

    const commonProps = {
      contentId: content.id,
      title: content.title,
      className: "w-full"
    };

    // Determine content type and render appropriate player
    const contentType = content.type.toLowerCase();
    
    if (contentType.startsWith('video') || contentType === 'video') {
      return (
        <VideoPlayer
          {...commonProps}
          src={content.fileUrl}
          poster={content.thumbnailUrl}
        />
      );
    }
    
    if (contentType.startsWith('audio') || contentType === 'audio') {
      return (
        <AudioPlayer
          {...commonProps}
          src={content.fileUrl}
          artist={content.artist.name}
          artwork={content.thumbnailUrl}
        />
      );
    }
    
    if (contentType.startsWith('image') || contentType === 'image') {
      return (
        <ImageViewer
          {...commonProps}
          src={content.fileUrl}
          alt={content.title}
        />
      );
    }

    // Fallback for unknown content types
    return (
      <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Unsupported content type: {content.type}</p>
          <a 
            href={content.fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Download file
          </a>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className="text-destructive mb-2">{error || 'Content not found'}</p>
          <button 
            onClick={fetchContent}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <ContentAccessControl 
        content={content} 
        onSubscribe={onSubscribe}
      >
        {renderMediaPlayer}
      </ContentAccessControl>
      
      {/* Comments Section - only show if content is accessible */}
      <CommentSystem 
        contentId={content.id}
        contentOwnerId={content.artist.id}
      />
    </div>
  );
}