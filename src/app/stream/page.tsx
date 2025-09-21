'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Play, 
  Pause, 
  Volume2, 
  Maximize, 
  Heart, 
  Share, 
  MessageCircle,
  Eye,
  Clock,
  User,
  Star,
  ChevronRight
} from 'lucide-react';

interface StreamData {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'audio' | 'image' | 'live';
  url: string;
  thumbnail: string;
  creator: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  stats: {
    views: number;
    likes: number;
    duration: number;
  };
  isExclusive: boolean;
  price: number;
  tags: string[];
  createdAt: string;
}

export default function StreamPage() {
  const router = useRouter();
  const [stream, setStream] = useState<StreamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    // In a real app, this would get the stream ID from the URL params
    // For demo purposes, we'll load a mock stream
    loadStream();
  }, []);

  const loadStream = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call to load stream data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockStream: StreamData = {
        id: 'stream-123',
        title: 'Behind the Scenes: Recording Session',
        description: 'Join me as I record my latest single in the studio. Get an exclusive look at my creative process and hear snippets of unreleased music.',
        type: 'video',
        url: '/mock-video.mp4',
        thumbnail: '/mock-thumbnail.jpg',
        creator: {
          name: 'Alex Morgan',
          avatar: '/mock-avatar.jpg',
          verified: true,
        },
        stats: {
          views: 15420,
          likes: 892,
          duration: 1845, // in seconds
        },
        isExclusive: true,
        price: 4.99,
        tags: ['music', 'studio', 'exclusive', 'recording'],
        createdAt: '2024-09-20T15:30:00Z',
      };

      setStream(mockStream);
    } catch (error) {
      console.error('Failed to load stream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleLike = () => {
    setLiked(!liked);
    // In real app, would make API call to like/unlike
  };

  const handleShare = () => {
    if (navigator.share && stream) {
      navigator.share({
        title: stream.title,
        text: stream.description,
        url: window.location.href,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      console.log('Link copied to clipboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Stream Not Found</h2>
              <p className="text-gray-600 mb-4">
                The stream you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => router.push('/discover')}>
                Browse Content
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Video Player */}
        <div className="aspect-video bg-gray-900 rounded-lg mb-6 relative group">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto">
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </div>
              <p className="text-sm text-gray-300">Click to {isPlaying ? 'pause' : 'play'}</p>
              <p className="text-xs text-gray-400 mt-2">
                Demo video player - {formatDuration(stream.stats.duration)}
              </p>
            </div>
          </div>
          
          {/* Player Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white hover:bg-opacity-20"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white hover:bg-opacity-20"
                >
                  <Volume2 className="w-5 h-5" />
                </Button>
                <span className="text-sm">
                  0:00 / {formatDuration(stream.stats.duration)}
                </span>
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-800 text-white">
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold mb-3">{stream.title}</h1>
                
                {/* Creator Info */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="font-semibold">{stream.creator.name}</h3>
                      {stream.creator.verified && (
                        <Star className="w-4 h-4 text-blue-400 ml-1 fill-current" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400">Content Creator</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-gray-700 text-white hover:bg-gray-800">
                    Follow
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-6 mb-4 text-sm text-gray-400">
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    {stream.stats.views.toLocaleString()} views
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDate(stream.createdAt)}
                  </div>
                  {stream.isExclusive && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                      Exclusive Content
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-4 mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLike}
                    className={`border-gray-700 hover:bg-gray-800 ${
                      liked ? 'text-red-500 border-red-500' : 'text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${liked ? 'fill-current' : ''}`} />
                    {stream.stats.likes + (liked ? 1 : 0)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 text-white hover:bg-gray-800"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Comment
                  </Button>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <p className="text-gray-300 mb-3">{stream.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {stream.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-800 text-gray-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Access Info */}
            {stream.isExclusive && (
              <Card className="bg-purple-900 border-purple-800 text-white">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Exclusive Content</h3>
                  <p className="text-sm text-purple-100 mb-3">
                    This is premium content available to supporters.
                  </p>
                  <div className="text-lg font-bold mb-3">
                    ${stream.price}
                  </div>
                  <Button className="w-full bg-white text-purple-900 hover:bg-gray-100">
                    Purchase Access
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Related Content */}
            <Card className="bg-gray-900 border-gray-800 text-white">
              <CardHeader>
                <CardTitle className="text-lg">Related Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded">
                    <div className="w-20 h-14 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                      <Play className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        Related Stream {i}
                      </h4>
                      <p className="text-xs text-gray-400">Alex Morgan</p>
                      <p className="text-xs text-gray-500">2.1k views</p>
                    </div>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-gray-700 text-white hover:bg-gray-800"
                  onClick={() => router.push('/discover')}
                >
                  View More
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}