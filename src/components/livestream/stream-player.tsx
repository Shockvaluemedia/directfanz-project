'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  UsersIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ShareIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import WebRTCViewer from './webrtc-viewer';
import WebRTCBroadcaster from './webrtc-broadcaster';

interface StreamMessage {
  id: string;
  senderId?: string;
  senderName: string;
  message: string;
  type: 'MESSAGE' | 'JOIN' | 'LEAVE' | 'TIP' | 'SYSTEM';
  isHighlighted: boolean;
  createdAt: string;
  sender?: {
    id: string;
    displayName: string;
    avatar?: string;
    role: string;
  };
}

interface LiveStreamData {
  id: string;
  title: string;
  description?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  isPublic: boolean;
  maxViewers: number;
  artist: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  currentViewers: any[];
  stats: {
    totalViewers: number;
    totalMessages: number;
    totalTips: number;
  };
}

interface StreamPlayerProps {
  streamId: string;
  autoplay?: boolean;
  showChat?: boolean;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
}

export default function StreamPlayer({
  streamId,
  autoplay = false,
  showChat = true,
  onStreamStart,
  onStreamEnd,
}: StreamPlayerProps) {
  const { data: session } = useSession();
  const [stream, setStream] = useState<LiveStreamData | null>(null);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showChatBox, setShowChatBox] = useState(showChat);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesPollingRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchStream();
    fetchMessages();

    // Poll for new messages every 3 seconds
    messagesPollingRef.current = setInterval(() => {
      fetchMessages();
    }, 3000);

    return () => {
      if (messagesPollingRef.current) {
        clearInterval(messagesPollingRef.current);
      }
    };
  }, [streamId]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/livestream/${streamId}`);
      if (response.ok) {
        const data = await response.json();
        setStream(data.data.stream);
      } else {
        toast.error('Stream not found or access denied');
      }
    } catch (error) {
      console.error('Failed to fetch stream:', error);
      toast.error('Failed to load stream');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/livestream/${streamId}/chat?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`/api/livestream/${streamId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          type: 'MESSAGE',
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Fetch messages immediately to show the new one
        fetchMessages();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const shareStream = async () => {
    try {
      await navigator.share({
        title: stream?.title || 'Live Stream',
        text: `Watch ${stream?.artist.displayName}'s live stream!`,
        url: window.location.href,
      });
    } catch (error) {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Stream link copied to clipboard!');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'JOIN':
        return 'text-green-600';
      case 'LEAVE':
        return 'text-gray-500';
      case 'TIP':
        return 'text-yellow-600';
      case 'SYSTEM':
        return 'text-blue-600';
      default:
        return 'text-gray-900';
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className='text-center py-8'>
        <p className='text-gray-500'>Stream not found</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Stream Header */}
      <div className='flex justify-between items-start'>
        <div className='flex-1'>
          <div className='flex items-center space-x-3 mb-2'>
            <h1 className='text-2xl font-bold text-gray-900'>{stream.title}</h1>
            {stream.status === 'LIVE' && (
              <Badge className='bg-red-100 text-red-800 animate-pulse'>🔴 LIVE</Badge>
            )}
          </div>
          <p className='text-gray-600 mb-2'>{stream.description}</p>
          <div className='flex items-center space-x-4 text-sm text-gray-500'>
            <div className='flex items-center'>
              <UsersIcon className='h-4 w-4 mr-1' />
              <span>{stream.currentViewers.length} watching</span>
            </div>
            <div className='flex items-center'>
              <ChatBubbleLeftIcon className='h-4 w-4 mr-1' />
              <span>{stream.stats.totalMessages} messages</span>
            </div>
            {stream.stats.totalTips > 0 && (
              <div className='flex items-center'>
                <HeartIcon className='h-4 w-4 mr-1' />
                <span>${stream.stats.totalTips} in tips</span>
              </div>
            )}
          </div>
        </div>
        <div className='flex space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={shareStream}
            className='flex items-center space-x-1'
          >
            <ShareIcon className='h-4 w-4' />
            <span>Share</span>
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Video Player */}
        <div className='lg:col-span-2'>
          {/* Check if user owns this stream to show broadcaster controls */}
          {stream.artist.id === session?.user?.id ? (
            <div className='space-y-4'>
              <WebRTCBroadcaster
                streamId={streamId}
                streamKey={stream.streamKey || ''}
                onStreamStart={onStreamStart}
                onStreamEnd={onStreamEnd}
                onViewerCountChange={count => {
                  // Update local state with viewer count
                  stream.currentViewers = new Array(count).fill({});
                }}
              />
            </div>
          ) : (
            <div className='space-y-4'>
              <WebRTCViewer
                streamId={streamId}
                onViewerCountChange={count => {
                  // Update local state with viewer count
                  stream.currentViewers = new Array(count).fill({});
                }}
                onStreamStatusChange={status => {
                  console.log('Stream status changed:', status);
                }}
              />
            </div>
          )}

          {/* Artist Info */}
          <Card className='mt-4'>
            <CardContent className='p-4'>
              <div className='flex items-center space-x-3'>
                {stream.artist.avatar ? (
                  <img
                    src={stream.artist.avatar}
                    alt={stream.artist.displayName}
                    className='h-12 w-12 rounded-full object-cover'
                  />
                ) : (
                  <div className='h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center'>
                    <UsersIcon className='h-6 w-6 text-gray-600' />
                  </div>
                )}
                <div>
                  <h4 className='font-semibold text-gray-900'>{stream.artist.displayName}</h4>
                  <p className='text-sm text-gray-500'>Artist</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Chat */}
        {showChatBox && (
          <div className='lg:col-span-1'>
            <Card className='h-[600px] flex flex-col'>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center justify-between'>
                  <span>Live Chat</span>
                  <Badge variant='outline'>{messages.length} messages</Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className='flex-1 flex flex-col p-0'>
                {/* Messages */}
                <div className='flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]'>
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`${message.isHighlighted ? 'bg-yellow-50 p-2 rounded' : ''}`}
                    >
                      <div className='flex items-start space-x-2'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-2 mb-1'>
                            <span className='font-medium text-sm'>
                              {message.sender?.displayName || message.senderName}
                            </span>
                            {message.sender?.role === 'ARTIST' && (
                              <Badge variant='outline' className='text-xs'>
                                Artist
                              </Badge>
                            )}
                            <span className='text-xs text-gray-500'>
                              {formatTimestamp(message.createdAt)}
                            </span>
                          </div>
                          <p className={`text-sm ${getMessageTypeColor(message.type)}`}>
                            {message.type === 'TIP' && '💰 '}
                            {message.type === 'JOIN' && '👋 '}
                            {message.type === 'LEAVE' && '👋 '}
                            {message.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />

                  {messages.length === 0 && (
                    <div className='text-center text-gray-500 py-8'>
                      <ChatBubbleLeftIcon className='h-8 w-8 mx-auto mb-2 opacity-50' />
                      <p>No messages yet</p>
                      <p className='text-xs'>Be the first to say hello!</p>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                {stream.status === 'LIVE' && (
                  <div className='border-t p-4'>
                    <form onSubmit={sendMessage} className='flex space-x-2'>
                      <input
                        type='text'
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder={session?.user ? 'Type a message...' : 'Sign in to chat'}
                        className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                        disabled={!session?.user}
                        maxLength={500}
                      />
                      <Button
                        type='submit'
                        size='sm'
                        disabled={!session?.user || !newMessage.trim()}
                      >
                        Send
                      </Button>
                    </form>
                    {!session?.user && (
                      <p className='text-xs text-gray-500 mt-2'>
                        <a href='/auth/signin' className='text-blue-600 hover:underline'>
                          Sign in
                        </a>{' '}
                        to participate in chat
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
