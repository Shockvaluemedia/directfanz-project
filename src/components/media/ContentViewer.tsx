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
  /** Access-checked app URLs; present when the viewer may play the media. */
  streamUrl?: string;
  downloadUrl?: string;
  /** Raw storage URL, only sent for public content or to the owner. */
  fileUrl?: string;
  thumbnailUrl?: string;
  visibility: string;
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
  /** Decided by the server; false renders the paywall. */
  hasAccess?: boolean;
}

// GET /api/content/[id] answers { success, data } with Prisma's `users` and
// `tiers[].minimumPrice`; the viewer speaks `artist` and `tiers[].price`.
function toContentData(raw: any): ContentData {
  const tiers = Array.isArray(raw.tiers)
    ? raw.tiers.map((tier: any) => ({
        id: tier.id,
        name: tier.name,
        price: Number(tier.price ?? tier.minimumPrice ?? 0),
        description: tier.description ?? undefined,
      }))
    : [];
  const artist = raw.artist ?? {
    id: raw.users?.id ?? raw.artistId ?? '',
    name: raw.users?.displayName ?? 'Artist',
    profileImage: raw.users?.avatar ?? undefined,
  };

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? undefined,
    type: raw.type ?? '',
    streamUrl: raw.streamUrl,
    downloadUrl: raw.downloadUrl,
    fileUrl: raw.fileUrl,
    thumbnailUrl: raw.thumbnailUrl ?? undefined,
    visibility: raw.visibility ?? 'PUBLIC',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt,
    totalViews: raw.totalViews ?? 0,
    tiers,
    artist,
    likes: raw.likes ?? raw.totalLikes,
    hasLiked: raw.hasLiked,
    commentsCount: raw.commentsCount ?? (Array.isArray(raw.comments) ? raw.comments.length : undefined),
    hasAccess: raw.hasAccess ?? Boolean(raw.streamUrl || raw.fileUrl),
  };
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
      if (response.status === 401) {
        throw new Error('Sign in to view this content');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }
      const payload = await response.json();
      setContent(toContentData(payload.data ?? payload));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderMediaPlayer = (hasAccess: boolean, content: ContentData) => {
    if (!hasAccess) return null;

    // Always play through the gated app URL; the raw storage URL, even when
    // present, is never what the media element should be given.
    const mediaSrc = content.streamUrl ?? `/api/content/${content.id}/stream`;
    const downloadHref = content.downloadUrl ?? `/api/content/${content.id}/download`;

    const commonProps = {
      contentId: content.id,
      title: content.title,
      className: 'w-full',
    };

    // Determine content type and render appropriate player
    const contentType = content.type.toLowerCase();

    if (contentType.startsWith('video') || contentType === 'video') {
      return <VideoPlayer {...commonProps} src={mediaSrc} poster={content.thumbnailUrl} />;
    }

    if (contentType.startsWith('audio') || contentType === 'audio') {
      return (
        <AudioPlayer
          {...commonProps}
          src={mediaSrc}
          artist={content.artist.name}
          artwork={content.thumbnailUrl}
        />
      );
    }

    if (contentType.startsWith('image') || contentType === 'image') {
      return <ImageViewer {...commonProps} src={mediaSrc} alt={content.title} />;
    }

    // Fallback for unknown content types
    return (
      <div className='aspect-video bg-muted flex items-center justify-center rounded-lg'>
        <div className='text-center'>
          <p className='text-muted-foreground mb-2'>Unsupported content type: {content.type}</p>
          <a href={downloadHref} className='text-primary hover:underline'>
            Download file
          </a>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className='text-center'>
          <p className='text-destructive mb-2'>{error || 'Content not found'}</p>
          <button onClick={fetchContent} className='text-primary hover:underline'>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <ContentAccessControl content={content} onSubscribe={onSubscribe}>
        {renderMediaPlayer}
      </ContentAccessControl>

      {/* Comments Section - only show if content is accessible */}
      {content.hasAccess && (
        <CommentSystem contentId={content.id} contentOwnerId={content.artist.id} />
      )}
    </div>
  );
}
