'use client';

/**
 * Live Stream Viewer - AWS MediaPackage HLS Integration
 *
 * Professional stream viewer with:
 * - HLS streaming from AWS MediaPackage
 * - Adaptive bitrate playback
 * - CloudFront CDN delivery
 * - Real-time chat and donations
 * - Stream interactions and analytics
 * - Mobile-optimized experience
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  HandRaisedIcon,
  FaceSmileIcon,
  PresentationChartLineIcon,
  ClockIcon,
  CalendarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  UserPlusIcon as UserPlusIconSolid,
} from '@heroicons/react/24/solid';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import HLSPlayer from './HLSPlayer';

// Types
interface Stream {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'scheduled' | 'starting' | 'live' | 'ending' | 'ended';
  streamer: {
    id: string;
    userName: string;
    displayName: string;
    avatar?: string;
    followers: number;
    isVerified: boolean;
  };
  metadata: {
    currentViewers: number;
    totalViews: number;
    duration: number;
    totalDonations: number;
    likes: number;
    shares: number;
    chatMessages: number;
    quality: string[];
    maxQuality: string;
  };
  settings: {
    enableChat: boolean;
    enableDonations: boolean;
    chatModeration: string;
    subscribersOnly: boolean;
  };
  scheduledStart?: Date;
  startedAt?: Date;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  type: 'message' | 'donation' | 'subscription' | 'system' | 'emoji';
  createdAt: Date;
  metadata?: {
    donationAmount?: number;
    subscriptionTier?: string;
    emoji?: string;
  };
}

interface Donation {
  id: string;
  donorName: string;
  amount: number;
  message?: string;
  createdAt: Date;
}

interface ViewerProps {
  streamId: string;
  autoPlay?: boolean;
  showControls?: boolean;
  className?: string;
}

export default function LiveStreamViewer({
  streamId,
  autoPlay = true,
  showControls = true,
  className,
}: ViewerProps) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Interaction state
  const [hasLiked, setHasLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationAmount, setDonationAmount] = useState(5);
  const [donationMessage, setDonationMessage] = useState('');
  const [showDonationModal, setShowDonationModal] = useState(false);

  // UI state
  const [showControls, setShowControlsState] = useState(showControls);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection and fetch stream data
  useEffect(() => {
    if (!streamId) return;

    const fetchStream = async () => {
      try {
        const response = await fetch(`/api/streaming/${streamId}`);
        if (!response.ok) throw new Error('Stream not found');
        
        const data = await response.json();
        setStream(data);
        setChatMessages(data.chatMessages || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch stream:', error);
        setIsLoading(false);
      }
    };

    fetchStream();

    // Initialize WebSocket for real-time features
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      auth: {
        token: session?.accessToken,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to streaming server');
      setSocket(newSocket);
      setIsConnected(true);
      newSocket.emit('join_stream', { streamId });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time events
    newSocket.on('viewer_count_updated', (data) => {
      setStream(prev => prev ? {
        ...prev,
        metadata: { ...prev.metadata, currentViewers: data.count }
      } : null);
    });

    newSocket.on('stream_chat_message', handleChatMessage);
    newSocket.on('stream_donation', handleDonation);

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [streamId, session?.accessToken]);

  // Setup WebRTC connection
  useEffect(() => {
    if (!socket || !stream) return;

    setupWebRTCConnection();
  }, [socket, stream]);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControlsState(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const timeout = setTimeout(() => {
        if (!showQualityMenu && !showDonationModal) {
          setShowControlsState(false);
        }
      }, 3000);
      setControlsTimeout(timeout);
    };

    const container = containerRef.current;
    if (container && showControls) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        if (controlsTimeout) clearTimeout(controlsTimeout);
      };
    }
  }, [showControls, showQualityMenu, showDonationModal, controlsTimeout]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Socket event handlers
  const handleStreamData = useCallback(
    (data: { stream: Stream; chatHistory: ChatMessage[] }) => {
      setStream(data.stream);
      setChatMessages(data.chatHistory || []);
      setIsLoading(false);

      // Check if user is following
      if (session?.user?.id) {
        // This would typically come from the server
        setIsFollowing(false); // TODO: Get actual follow status
      }
    },
    [session?.user?.id]
  );

  const handleStreamEnded = useCallback((data: { streamId: string; reason: string }) => {
    setStream(prev => (prev ? { ...prev, status: 'ended' } : null));
    toast.info('Stream has ended');
    setIsPlaying(false);
  }, []);

  const handleViewerCountUpdated = useCallback((data: { currentViewers: number }) => {
    setStream(prev =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, currentViewers: data.currentViewers },
          }
        : null
    );
  }, []);

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages(prev => [...prev, message]);

    // Update chat message count
    setStream(prev =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, chatMessages: prev.metadata.chatMessages + 1 },
          }
        : null
    );
  }, []);

  const handleDonation = useCallback((data: { donation: Donation; chatMessage: ChatMessage }) => {
    setDonations(prev => [data.donation, ...prev]);
    setChatMessages(prev => [...prev, data.chatMessage]);

    // Update donation total
    setStream(prev =>
      prev
        ? {
            ...prev,
            metadata: {
              ...prev.metadata,
              totalDonations: prev.metadata.totalDonations + data.donation.amount,
            },
          }
        : null
    );

    // Show donation toast
    toast.success(`${data.donation.donorName} donated $${data.donation.amount}!`);
  }, []);

  const handleWebRTCOffer = useCallback(
    async (data: { offer: RTCSessionDescriptionInit; senderId: string }) => {
      if (!peerConnection.current || !socket) return;

      try {
        await peerConnection.current.setRemoteDescription(data.offer);

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          streamId,
          answer,
          senderId: data.senderId,
        });
      } catch (error) {
        console.error('WebRTC answer error:', error);
      }
    },
    [socket, streamId]
  );

  const handleICECandidate = useCallback(
    async (data: { candidate: RTCIceCandidateInit; senderId: string }) => {
      if (peerConnection.current && data.candidate) {
        try {
          await peerConnection.current.addIceCandidate(data.candidate);
        } catch (error) {
          console.error('ICE candidate error:', error);
        }
      }
    },
    []
  );

  // WebRTC setup
  const setupWebRTCConnection = async () => {
    if (!socket || !stream || peerConnection.current) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pc.ontrack = event => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            streamId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsBuffering(false);
        } else if (pc.connectionState === 'connecting') {
          setIsBuffering(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsBuffering(false);
          toast.error('Stream connection lost');
        }
      };

      peerConnection.current = pc;

      // Request stream offer
      socket.emit('request_stream', { streamId });
    } catch (error) {
      console.error('WebRTC setup error:', error);
      toast.error('Failed to setup stream connection');
    }
  };

  // Player controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    if (videoRef.current) {
      try {
        if (!document.pictureInPictureElement) {
          await videoRef.current.requestPictureInPicture();
          setIsPictureInPicture(true);
        } else {
          await document.exitPictureInPicture();
          setIsPictureInPicture(false);
        }
      } catch (error) {
        console.error('PiP error:', error);
      }
    }
  }, []);

  // Chat functions
  const sendChatMessage = useCallback(() => {
    if (!socket || !stream || !chatInput.trim() || !session?.user) return;

    socket.emit('stream_chat', {
      streamId: stream.id,
      message: chatInput.trim(),
    });

    setChatInput('');
  }, [socket, stream, chatInput, session?.user]);

  const sendEmoji = useCallback(
    (emoji: string) => {
      if (!socket || !stream || !session?.user) return;

      socket.emit('stream_emoji', {
        streamId: stream.id,
        emoji,
      });

      setShowEmojiPicker(false);
    },
    [socket, stream, session?.user]
  );

  // Interaction functions
  const toggleLike = useCallback(() => {
    if (!socket || !stream || !session?.user) return;

    socket.emit('stream_like', {
      streamId: stream.id,
      action: hasLiked ? 'unlike' : 'like',
    });

    setHasLiked(!hasLiked);
    setStream(prev =>
      prev
        ? {
            ...prev,
            metadata: {
              ...prev.metadata,
              likes: prev.metadata.likes + (hasLiked ? -1 : 1),
            },
          }
        : null
    );
  }, [socket, stream, session?.user, hasLiked]);

  const toggleFollow = useCallback(() => {
    if (!socket || !stream || !session?.user) return;

    socket.emit('follow_streamer', {
      streamerId: stream.streamer.id,
      action: isFollowing ? 'unfollow' : 'follow',
    });

    setIsFollowing(!isFollowing);
    toast.success(isFollowing ? 'Unfollowed' : 'Followed!');
  }, [socket, stream, session?.user, isFollowing]);

  const shareStream = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: stream?.title || 'Live Stream',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Stream link copied to clipboard!');
    }
  }, [stream]);

  const sendDonation = useCallback(() => {
    if (!socket || !stream || !session?.user || donationAmount <= 0) return;

    socket.emit('stream_donation', {
      streamId: stream.id,
      amount: donationAmount,
      message: donationMessage.trim() || undefined,
    });

    setDonationMessage('');
    setShowDonationModal(false);
    toast.success(`Donated $${donationAmount}!`);
  }, [socket, stream, session?.user, donationAmount, donationMessage]);

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div
        className={cn('flex items-center justify-center h-64 bg-gray-900 text-white', className)}
      >
        <div className='text-center'>
          <div className='animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4'></div>
          <p className='text-gray-400'>Loading stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div
        className={cn('flex items-center justify-center h-64 bg-gray-900 text-white', className)}
      >
        <div className='text-center'>
          <p className='text-gray-400 mb-4'>Stream not found</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900 text-white', className)}>
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
        {/* Main Video Player */}
        <div className='lg:col-span-3'>
          <div className='relative bg-black rounded-lg overflow-hidden'>
            {/* HLS Video Player */}
            {stream?.playbackUrl ? (
              <HLSPlayer
                src={stream.playbackUrl}
                autoPlay={autoPlay}
                controls={showControls}
                className='aspect-video'
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(error) => {
                  console.error('HLS Player error:', error);
                  toast.error('Video playback error');
                }}
              />
            ) : (
              <div className='aspect-video flex items-center justify-center'>
                <div className='text-center'>
                  <div className='w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'>
                    <VideoCameraIcon className='w-8 h-8 text-gray-400' />
                  </div>
                  <p className='text-gray-400'>
                    {stream?.status === 'SCHEDULED' ? 'Stream not started yet' : 'Stream not available'}
                  </p>
                </div>
              </div>
            )}

            {/* Stream Status Overlay */}
            {stream?.status === 'LIVE' && (
              <div className='absolute top-4 left-4 flex items-center gap-4 z-10'>
                <div className='flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full'>
                  <div className='w-2 h-2 bg-white rounded-full animate-pulse' />
                  <span className='text-sm font-medium'>LIVE</span>
                </div>

                <div className='bg-black/50 px-3 py-1 rounded-full'>
                  <span className='text-sm'>{formatDuration(stream.metadata?.duration || 0)}</span>
                </div>
              </div>
            )}

            {/* Stream Info Overlay */}
            <div className='absolute top-4 right-4 flex items-center gap-4 z-10'>
              <div className='flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full'>
                <EyeIcon className='w-4 h-4' />
                <span className='text-sm'>{stream?.metadata?.currentViewers?.toLocaleString() || 0}</span>
              </div>
            </div>

          </div>

          {/* Stream Info */}
          <div className='bg-gray-800 rounded-lg p-6 mt-4'>
            <div className='flex items-start justify-between mb-4'>
              <div>
                <h1 className='text-2xl font-bold mb-2'>{stream.title}</h1>
                <p className='text-gray-300 mb-4'>{stream.description}</p>

                <div className='flex items-center gap-4'>
                  <div className='flex items-center gap-3'>
                    <img
                      src={stream.streamer.avatar || '/default-avatar.png'}
                      alt={stream.streamer.displayName}
                      className='w-10 h-10 rounded-full'
                    />
                    <div>
                      <h3 className='font-semibold flex items-center gap-2'>
                        {stream.streamer.displayName}
                        {stream.streamer.isVerified && <span className='text-blue-500'>✓</span>}
                      </h3>
                      <p className='text-sm text-gray-400'>
                        {stream.streamer.followers.toLocaleString()} followers
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 ml-auto'>
                    <button
                      onClick={toggleFollow}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                        isFollowing
                          ? 'bg-gray-600 hover:bg-gray-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      {isFollowing ? (
                        <UserPlusIconSolid className='w-4 h-4' />
                      ) : (
                        <UserPlusIcon className='w-4 h-4' />
                      )}
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stream Stats */}
            <div className='grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-700 rounded-lg'>
              <div className='text-center'>
                <div className='text-xl font-bold'>
                  {stream?.metadata?.currentViewers?.toLocaleString() || 0}
                </div>
                <div className='text-sm text-gray-400'>Watching</div>
              </div>

              <div className='text-center'>
                <div className='text-xl font-bold'>
                  {stream?.metadata?.totalViews?.toLocaleString() || 0}
                </div>
                <div className='text-sm text-gray-400'>Total Views</div>
              </div>

              <div className='text-center'>
                <div className='text-xl font-bold text-red-400'>
                  {stream?.metadata?.likes?.toLocaleString() || 0}
                </div>
                <div className='text-sm text-gray-400'>Likes</div>
              </div>

              <div className='text-center'>
                <div className='text-xl font-bold text-green-400'>
                  ${stream?.metadata?.totalDonations?.toLocaleString() || 0}
                </div>
                <div className='text-sm text-gray-400'>Donations</div>
              </div>

              <div className='text-center'>
                <div className='text-xl font-bold'>{formatDuration(stream?.metadata?.duration || 0)}</div>
                <div className='text-sm text-gray-400'>Duration</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex items-center gap-4 mt-4'>
              <button
                onClick={toggleLike}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  hasLiked ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                )}
              >
                {hasLiked ? (
                  <HeartIconSolid className='w-5 h-5' />
                ) : (
                  <HeartIcon className='w-5 h-5' />
                )}
                Like
              </button>

              <button
                onClick={shareStream}
                className='flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors'
              >
                <ShareIcon className='w-5 h-5' />
                Share
              </button>

              {stream.settings.enableDonations && session?.user && (
                <button
                  onClick={() => setShowDonationModal(true)}
                  className='flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors'
                >
                  <CurrencyDollarIcon className='w-5 h-5' />
                  Donate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Chat */}
          {stream.settings.enableChat && (
            <div className='bg-gray-800 rounded-lg'>
              <div className='p-4 border-b border-gray-700'>
                <h3 className='font-semibold flex items-center justify-between'>
                  <span className='flex items-center gap-2'>
                    <ChatBubbleLeftRightIcon className='w-5 h-5' />
                    Live Chat
                  </span>
                  <span className='text-sm text-gray-400'>
                    {stream.metadata.chatMessages} messages
                  </span>
                </h3>
              </div>

              <div className='h-64 overflow-y-auto p-4 space-y-3'>
                {chatMessages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      'text-sm',
                      message.type === 'system' && 'text-gray-400 italic',
                      message.type === 'donation' &&
                        'bg-yellow-600/20 p-2 rounded border border-yellow-600/30',
                      message.type === 'emoji' && 'text-center text-2xl'
                    )}
                  >
                    {message.type === 'emoji' ? (
                      <span>{message.metadata?.emoji}</span>
                    ) : message.type !== 'system' ? (
                      <>
                        <span className='font-medium text-blue-400'>{message.userName}: </span>
                        <span>{message.content}</span>
                        {message.metadata?.donationAmount && (
                          <span className='text-yellow-400 ml-2'>
                            (${message.metadata.donationAmount})
                          </span>
                        )}
                      </>
                    ) : (
                      <span>{message.content}</span>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {session?.user && (
                <div className='p-4 border-t border-gray-700'>
                  <div className='flex gap-2 mb-2'>
                    <input
                      type='text'
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                      placeholder='Type a message...'
                      className='flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                      disabled={stream.settings.subscribersOnly && !isFollowing}
                    />
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className='p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors'
                    >
                      <FaceSmileIcon className='w-5 h-5' />
                    </button>
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim()}
                      className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors text-sm'
                    >
                      Send
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className='absolute bottom-full mb-2 right-0 z-10'>
                      <EmojiPicker onEmojiClick={emoji => sendEmoji(emoji.emoji)} theme='dark' />
                    </div>
                  )}

                  {stream.settings.subscribersOnly && !isFollowing && (
                    <p className='text-xs text-gray-400 mt-2'>Follow to participate in chat</p>
                  )}
                </div>
              )}

              {!session?.user && (
                <div className='p-4 border-t border-gray-700 text-center'>
                  <p className='text-sm text-gray-400 mb-2'>Sign in to chat</p>
                </div>
              )}
            </div>
          )}

          {/* Recent Donations */}
          {donations.length > 0 && (
            <div className='bg-gray-800 rounded-lg p-4'>
              <h3 className='font-semibold mb-4 flex items-center gap-2'>
                <CurrencyDollarIcon className='w-5 h-5' />
                Recent Donations
              </h3>

              <div className='space-y-3 max-h-48 overflow-y-auto'>
                {donations.slice(0, 10).map(donation => (
                  <div key={donation.id} className='bg-gray-700 p-3 rounded'>
                    <div className='flex justify-between items-start mb-1'>
                      <span className='font-medium text-sm'>{donation.donorName}</span>
                      <span className='text-green-400 font-bold'>${donation.amount}</span>
                    </div>
                    {donation.message && (
                      <p className='text-xs text-gray-300'>{donation.message}</p>
                    )}
                    <p className='text-xs text-gray-400 mt-1'>
                      {formatDistanceToNow(donation.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Donation Modal */}
      {showDonationModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-gray-800 rounded-lg p-6 w-full max-w-md'>
            <h3 className='text-lg font-semibold mb-4'>Send Donation</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Amount</label>
                <div className='flex gap-2 mb-2'>
                  {[5, 10, 25, 50, 100].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setDonationAmount(amount)}
                      className={cn(
                        'px-3 py-1 rounded text-sm transition-colors',
                        donationAmount === amount
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      )}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <input
                  type='number'
                  value={donationAmount}
                  onChange={e => setDonationAmount(Number(e.target.value))}
                  min='1'
                  max='1000'
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent'
                />
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Message (Optional)</label>
                <textarea
                  value={donationMessage}
                  onChange={e => setDonationMessage(e.target.value)}
                  placeholder='Leave a message...'
                  rows={3}
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none'
                />
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={() => setShowDonationModal(false)}
                  className='flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={sendDonation}
                  disabled={donationAmount <= 0}
                  className='flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium'
                >
                  Donate ${donationAmount}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
