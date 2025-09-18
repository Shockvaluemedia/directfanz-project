'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, 
  Star, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  CreditCard,
  CheckCircle
} from 'lucide-react';
import { useSession } from 'next-auth/react';

interface ContentTier {
  id: string;
  name: string;
  price: number;
  description?: string;
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
  tiers: ContentTier[];
  artist: {
    id: string;
    name: string;
    profileImage?: string;
  };
  likes?: number;
  hasLiked?: boolean;
  commentsCount?: number;
}

interface UserSubscription {
  tierId: string;
  tierName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
}

interface ContentAccessControlProps {
  content: ContentData;
  children: (hasAccess: boolean, content: ContentData) => React.ReactNode;
  onSubscribe?: (tierId: string) => void;
}

export function ContentAccessControl({ 
  content, 
  children, 
  onSubscribe 
}: ContentAccessControlProps) {
  const { data: session } = useSession();
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLiked, setHasLiked] = useState(content.hasLiked || false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);

  useEffect(() => {
    if (session?.user) {
      fetchUserSubscriptions();
    } else {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchUserSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setUserSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to fetch user subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has access to this content
  const hasAccess = () => {
    // Public content is always accessible
    if (content.visibility === 'PUBLIC') {
      return true;
    }

    // Private content is only accessible to the owner (handled by API)
    if (content.visibility === 'PRIVATE') {
      return session?.user?.id === content.artist.id;
    }

    // Tier-locked content requires active subscription
    if (content.visibility === 'TIER_LOCKED') {
      if (!session?.user) return false;
      
      // Check if user has active subscription to any required tier
      const requiredTierIds = content.tiers.map(tier => tier.id);
      return userSubscriptions.some(sub => 
        requiredTierIds.includes(sub.tierId) && 
        sub.status === 'ACTIVE' &&
        new Date(sub.expiresAt) > new Date()
      );
    }

    return false;
  };

  const handleLike = async () => {
    if (!session?.user) return;

    try {
      const response = await fetch(`/api/content/${content.id}/like`, {
        method: hasLiked ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        setHasLiked(!hasLiked);
        setLikeCount(prev => hasLiked ? prev - 1 : prev + 1);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: content.title,
        text: content.description || `Check out this ${content.type} by ${content.artist.name}`,
        url: window.location.href,
      });
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleSubscribe = (tierId: string) => {
    onSubscribe?.(tierId);
  };

  const userAccess = hasAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user has access, render the content
  if (userAccess) {
    return (
      <div className="space-y-4">
        {/* Content Header */}
        <div className="flex items-start justify-between">
          <div className="flex-grow">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                {content.artist.profileImage ? (
                  <img 
                    src={content.artist.profileImage} 
                    alt={content.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-sm">
                      {content.artist.name[0]}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold">{content.artist.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(content.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <h2 className="text-xl font-bold mb-2">{content.title}</h2>
            {content.description && (
              <p className="text-muted-foreground mb-3">{content.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="capitalize">
                {content.type}
              </Badge>
              {content.visibility !== 'PUBLIC' && (
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  {content.visibility === 'TIER_LOCKED' ? 'Subscribers Only' : 'Private'}
                </Badge>
              )}
              {content.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Render the actual content */}
        {children(true, content)}

        {/* Engagement Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={hasLiked ? 'text-red-500' : ''}
            >
              <Heart className={`h-4 w-4 mr-1 ${hasLiked ? 'fill-current' : ''}`} />
              {likeCount}
            </Button>
            
            <Button variant="ghost" size="sm">
              <MessageCircle className="h-4 w-4 mr-1" />
              {content.commentsCount || 0}
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{content.totalViews.toLocaleString()} views</span>
          </div>
        </div>
      </div>
    );
  }

  // Access denied - show paywall
  return (
    <div className="space-y-4">
      {/* Content Preview */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-grow">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              {content.artist.profileImage ? (
                <img 
                  src={content.artist.profileImage} 
                  alt={content.artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">
                    {content.artist.name[0]}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold">{content.artist.name}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(content.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <h2 className="text-xl font-bold mb-2">{content.title}</h2>
          {content.description && (
            <p className="text-muted-foreground mb-3">{content.description}</p>
          )}
        </div>
      </div>

      {/* Blurred Preview */}
      <Card className="relative overflow-hidden">
        <div className="aspect-video bg-muted flex items-center justify-center relative">
          {content.thumbnailUrl && (
            <img 
              src={content.thumbnailUrl}
              alt={content.title}
              className="w-full h-full object-cover blur-xl opacity-30"
            />
          )}
          
          {/* Lock Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white">
              <Lock className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">
                {content.visibility === 'PRIVATE' ? 'Private Content' : 'Subscribers Only'}
              </h3>
              <p className="text-white/80 mb-4">
                {content.visibility === 'PRIVATE' 
                  ? 'This content is private and not available for viewing.'
                  : 'Subscribe to unlock this exclusive content'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Subscription Options */}
      {content.visibility === 'TIER_LOCKED' && content.tiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Subscribe to Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Choose a subscription tier to unlock this content and support {content.artist.name}
            </p>
            
            <div className="space-y-3">
              {content.tiers.map((tier) => (
                <div key={tier.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{tier.name}</h4>
                    {tier.description && (
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    )}
                    <div className="flex items-center mt-1">
                      <span className="text-lg font-bold">${tier.price}</span>
                      <span className="text-sm text-muted-foreground ml-1">/month</span>
                    </div>
                  </div>
                  
                  <Button onClick={() => handleSubscribe(tier.id)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subscribe
                  </Button>
                </div>
              ))}
            </div>
            
            {!session?.user && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-center">
                  <Button variant="link" className="p-0 h-auto">Sign in</Button>
                  {' '}or{' '}
                  <Button variant="link" className="p-0 h-auto">create an account</Button>
                  {' '}to subscribe
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Login Prompt for Non-authenticated Users */}
      {!session?.user && content.visibility === 'TIER_LOCKED' && (
        <Card>
          <CardContent className="p-6 text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Sign in to access exclusive content</h3>
            <p className="text-muted-foreground mb-4">
              Join Nahvee Even to subscribe to your favorite artists and access exclusive content
            </p>
            <div className="flex justify-center space-x-3">
              <Button>Sign In</Button>
              <Button variant="outline">Create Account</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Engagement (limited) */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" disabled>
            <Heart className="h-4 w-4 mr-1" />
            {likeCount}
          </Button>
          
          <Button variant="ghost" size="sm" disabled>
            <MessageCircle className="h-4 w-4 mr-1" />
            {content.commentsCount || 0}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>{content.totalViews.toLocaleString()} views</span>
        </div>
      </div>
    </div>
  );
}