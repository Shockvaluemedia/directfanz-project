'use client';

/**
 * Live Streaming Studio - Client Component
 *
 * This component provides a comprehensive live streaming interface with:
 * - WebRTC streaming setup and management
 * - Stream creation and configuration
 * - Real-time chat overlay with moderation
 * - Donation/tip interface during streams
 * - Viewer count and engagement metrics
 * - Stream quality controls and analytics
 * - Mobile streaming support
 * - Stream scheduling and notifications
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PlayIcon,
  StopIcon,
  PauseIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  CurrencyDollarIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  SpeakerWaveIcon,
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  UserGroupIcon,
  BoltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  ShareIcon as ShareIconSolid,
} from '@heroicons/react/24/solid';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Types
interface StreamConfig {
  title: string;
  description: string;
  category: string;
  isPrivate: boolean;
  enableChat: boolean;
  enableDonations: boolean;
  enableRecording: boolean;
  chatModeration: 'disabled' | 'keywords' | 'manual' | 'auto';
  donationGoal?: number;
  subscribersOnly: boolean;
  scheduledStart?: Date;
}

interface ActiveStream {
  id: string;
  title: string;
  status: 'scheduled' | 'starting' | 'live' | 'ending' | 'ended';
  metadata: {
    currentViewers: number;
    totalViews: number;
    duration: number;
    totalDonations: number;
    likes: number;
    shares: number;
    chatMessages: number;
  };
  rtmpUrl?: string;
  rtmpKey?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  type: 'message' | 'donation' | 'subscription' | 'system';
  createdAt: Date;
  metadata?: {
    donationAmount?: number;
    subscriptionTier?: string;
  };
}

interface Donation {
  id: string;
  donorName: string;
  amount: number;
  message?: string;
  createdAt: Date;
}

interface StreamAnalytics {
  viewerTrend: Array<{ time: Date; viewers: number }>;
  chatActivity: Array<{ time: Date; messages: number }>;
  donations: Array<{ time: Date; amount: number }>;
  engagement: {
    likes: number;
    shares: number;
    averageWatchTime: number;
    retention: number;
  };
}

export default function LiveStreamStudio() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({
    title: '',
    description: '',
    category: 'Music',
    isPrivate: false,
    enableChat: true,
    enableDonations: true,
    enableRecording: true,
    chatModeration: 'keywords',
    subscribersOnly: false,
  });

  // Stream state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamQuality, setStreamQuality] = useState('720p');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [donations, setDonations] = useState<Donation[]>([]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [donationAmount, setDonationAmount] = useState(5);
  const [donationMessage, setDonationMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!session?.user?.id) return;

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: {
        token: session.accessToken,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to streaming server');
      setSocket(newSocket);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from streaming server');
      setIsConnected(false);
    });

    newSocket.on('error', error => {
      console.error('Streaming error:', error);
      toast.error(error.message || 'Connection error');
    });

    // Stream events
    newSocket.on('stream_created', handleStreamCreated);
    newSocket.on('stream_start_success', handleStreamStarted);
    newSocket.on('stream_end_success', handleStreamEnded);
    newSocket.on('viewer_joined', handleViewerJoined);
    newSocket.on('viewer_left', handleViewerLeft);

    // Chat events
    newSocket.on('stream_chat_message', handleChatMessage);
    newSocket.on('stream_donation', handleDonation);

    // WebRTC signaling
    newSocket.on('webrtc_answer', handleWebRTCAnswer);
    newSocket.on('ice_candidate', handleICECandidate);

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [session?.user?.id]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Socket event handlers
  const handleStreamCreated = useCallback((data: { stream: any; rtmpUrl: string }) => {
    setActiveStream({
      id: data.stream.id,
      title: data.stream.title,
      status: data.stream.status,
      metadata: data.stream.metadata,
      rtmpUrl: data.rtmpUrl,
      rtmpKey: data.stream.settings.rtmpKey,
    });
    toast.success('Stream created successfully!');
  }, []);

  const handleStreamStarted = useCallback((data: { streamId: string }) => {
    setActiveStream(prev => (prev ? { ...prev, status: 'live' } : null));
    setIsStreaming(true);
    toast.success('Stream is now live!');
  }, []);

  const handleStreamEnded = useCallback((data: { streamId: string }) => {
    setActiveStream(prev => (prev ? { ...prev, status: 'ended' } : null));
    setIsStreaming(false);
    toast.info('Stream ended');
  }, []);

  const handleViewerJoined = useCallback((data: { viewer: any; currentViewers: number }) => {
    setActiveStream(prev =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, currentViewers: data.currentViewers },
          }
        : null
    );

    // Add system message
    const systemMessage: ChatMessage = {
      id: `system_${Date.now()}`,
      userId: 'system',
      userName: 'System',
      content: `${data.viewer.userName} joined the stream`,
      type: 'system',
      createdAt: new Date(),
    };
    setChatMessages(prev => [...prev, systemMessage]);
  }, []);

  const handleViewerLeft = useCallback((data: { viewerId: string; currentViewers: number }) => {
    setActiveStream(prev =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, currentViewers: data.currentViewers },
          }
        : null
    );
  }, []);

  const handleChatMessage = useCallback(
    (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);

      if (activeStream) {
        setActiveStream(prev =>
          prev
            ? {
                ...prev,
                metadata: { ...prev.metadata, chatMessages: prev.metadata.chatMessages + 1 },
              }
            : null
        );
      }
    },
    [activeStream]
  );

  const handleDonation = useCallback(
    (data: { donation: Donation; chatMessage: ChatMessage }) => {
      setDonations(prev => [data.donation, ...prev]);
      setChatMessages(prev => [...prev, data.chatMessage]);

      if (activeStream) {
        setActiveStream(prev =>
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
      }

      toast.success(`New donation: $${data.donation.amount} from ${data.donation.donorName}!`);
    },
    [activeStream]
  );

  const handleWebRTCAnswer = useCallback(
    async (data: { answer: RTCSessionDescriptionInit; viewerId: string }) => {
      const peerConnection = peerConnections.current.get(data.viewerId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(data.answer);
      }
    },
    []
  );

  const handleICECandidate = useCallback(
    async (data: { candidate: RTCIceCandidateInit; senderId: string }) => {
      const peerConnection = peerConnections.current.get(data.senderId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(data.candidate);
      }
    },
    []
  );

  // Stream management functions
  const createStream = useCallback(async () => {
    if (!socket || !streamConfig.title.trim()) return;

    setIsLoading(true);
    try {
      socket.emit('create_stream', streamConfig);
    } catch (error) {
      toast.error('Failed to create stream');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [socket, streamConfig]);

  const startStream = useCallback(async () => {
    if (!socket || !activeStream) return;

    setIsLoading(true);
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start WebRTC streaming
      await setupWebRTCStreaming(stream);

      // Start the stream
      socket.emit('start_stream', { streamId: activeStream.id });
    } catch (error) {
      toast.error('Failed to start stream');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [socket, activeStream]);

  const setupWebRTCStreaming = async (stream: MediaStream) => {
    if (!socket || !activeStream) return;

    // Create offer and send to server
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          streamId: activeStream.id,
          candidate: event.candidate,
        });
      }
    };

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', {
      streamId: activeStream.id,
      offer: offer,
    });
  };

  const endStream = useCallback(async () => {
    if (!socket || !activeStream) return;

    setIsLoading(true);
    try {
      // Stop local stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clean up peer connections
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();

      socket.emit('end_stream', { streamId: activeStream.id });
    } catch (error) {
      toast.error('Failed to end stream');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [socket, activeStream]);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const sendChatMessage = useCallback(() => {
    if (!socket || !activeStream || !chatInput.trim()) return;

    socket.emit('stream_chat', {
      streamId: activeStream.id,
      message: chatInput.trim(),
    });

    setChatInput('');
  }, [socket, activeStream, chatInput]);

  const sendLike = useCallback(() => {
    if (!socket || !activeStream) return;

    socket.emit('stream_like', { streamId: activeStream.id });

    setActiveStream(prev =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, likes: prev.metadata.likes + 1 },
          }
        : null
    );
  }, [socket, activeStream]);

  const sendDonation = useCallback(() => {
    if (!socket || !activeStream || donationAmount <= 0) return;

    socket.emit('stream_donation', {
      streamId: activeStream.id,
      amount: donationAmount,
      message: donationMessage.trim() || undefined,
    });

    setDonationMessage('');
  }, [socket, activeStream, donationAmount, donationMessage]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>Please sign in to access streaming</p>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-900 text-white'>
      {/* Header */}
      <div className='bg-gray-800 border-b border-gray-700 p-4'>
        <div className='max-w-7xl mx-auto flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Live Stream Studio</h1>

          <div className='flex items-center gap-4'>
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-full text-sm',
                isConnected ? 'bg-green-600' : 'bg-red-600'
              )}
            >
              <div
                className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-green-300' : 'bg-red-300')}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className='p-2 hover:bg-gray-700 rounded-lg transition-colors'
            >
              <Cog6ToothIcon className='w-5 h-5' />
            </button>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto p-6'>
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Main Stream Area */}
          <div className='lg:col-span-3'>
            {/* Stream Preview */}
            <div className='bg-gray-800 rounded-lg overflow-hidden mb-6'>
              <div className='aspect-video bg-black relative'>
                <video ref={videoRef} autoPlay muted className='w-full h-full object-cover' />

                {/* Stream Overlay */}
                {activeStream && isStreaming && (
                  <div className='absolute top-4 left-4 flex items-center gap-4'>
                    <div className='flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full'>
                      <div className='w-2 h-2 bg-white rounded-full animate-pulse' />
                      <span className='text-sm font-medium'>LIVE</span>
                    </div>

                    <div className='bg-black/50 px-3 py-1 rounded-full'>
                      <span className='text-sm'>
                        {formatDuration(activeStream.metadata.duration)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stream Stats */}
                {activeStream && (
                  <div className='absolute top-4 right-4 flex items-center gap-4'>
                    <div className='flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full'>
                      <EyeIcon className='w-4 h-4' />
                      <span className='text-sm'>{activeStream.metadata.currentViewers}</span>
                    </div>

                    <div className='flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full'>
                      <CurrencyDollarIcon className='w-4 h-4' />
                      <span className='text-sm'>${activeStream.metadata.totalDonations}</span>
                    </div>
                  </div>
                )}

                {!activeStream && (
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='text-center'>
                      <div className='w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'>
                        <VideoCameraIcon className='w-8 h-8 text-gray-400' />
                      </div>
                      <p className='text-gray-400'>No stream active</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream Controls */}
              <div className='p-4 bg-gray-700'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-4'>
                    {!activeStream ? (
                      <button
                        onClick={createStream}
                        disabled={isLoading || !streamConfig.title.trim()}
                        className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors'
                      >
                        <PlayIcon className='w-5 h-5' />
                        Create Stream
                      </button>
                    ) : !isStreaming ? (
                      <button
                        onClick={startStream}
                        disabled={isLoading}
                        className='flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors'
                      >
                        <PlayIcon className='w-5 h-5' />
                        Go Live
                      </button>
                    ) : (
                      <button
                        onClick={endStream}
                        disabled={isLoading}
                        className='flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors'
                      >
                        <StopIcon className='w-5 h-5' />
                        End Stream
                      </button>
                    )}
                  </div>

                  {isStreaming && (
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={toggleAudio}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          isAudioEnabled
                            ? 'bg-gray-600 hover:bg-gray-500'
                            : 'bg-red-600 hover:bg-red-700'
                        )}
                      >
                        {isAudioEnabled ? (
                          <MicrophoneIcon className='w-5 h-5' />
                        ) : (
                          <div className='relative'>
                            <MicrophoneIcon className='w-5 h-5 text-red-400' />
                            <div className='absolute inset-0 w-5 h-5 flex items-center justify-center'>
                              <div className='w-6 h-0.5 bg-red-400 rotate-45' />
                            </div>
                          </div>
                        )}
                      </button>

                      <button
                        onClick={toggleVideo}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          isVideoEnabled
                            ? 'bg-gray-600 hover:bg-gray-500'
                            : 'bg-red-600 hover:bg-red-700'
                        )}
                      >
                        {isVideoEnabled ? (
                          <VideoCameraIcon className='w-5 h-5' />
                        ) : (
                          <VideoCameraSlashIcon className='w-5 h-5' />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stream Configuration */}
            {!activeStream && (
              <div className='bg-gray-800 rounded-lg p-6'>
                <h3 className='text-lg font-semibold mb-4'>Stream Configuration</h3>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Stream Title *</label>
                    <input
                      type='text'
                      value={streamConfig.title}
                      onChange={e => setStreamConfig(prev => ({ ...prev, title: e.target.value }))}
                      placeholder='Enter stream title...'
                      className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-2'>Category</label>
                    <select
                      value={streamConfig.category}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, category: e.target.value }))
                      }
                      className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    >
                      <option value='Music'>Music</option>
                      <option value='Talk'>Talk Show</option>
                      <option value='Gaming'>Gaming</option>
                      <option value='Art'>Art & Creative</option>
                      <option value='Education'>Education</option>
                      <option value='Other'>Other</option>
                    </select>
                  </div>

                  <div className='md:col-span-2'>
                    <label className='block text-sm font-medium mb-2'>Description</label>
                    <textarea
                      value={streamConfig.description}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, description: e.target.value }))
                      }
                      placeholder='Describe your stream...'
                      rows={3}
                      className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
                    />
                  </div>
                </div>

                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mt-4'>
                  <label className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={streamConfig.enableChat}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, enableChat: e.target.checked }))
                      }
                      className='mr-2 rounded'
                    />
                    <span className='text-sm'>Enable Chat</span>
                  </label>

                  <label className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={streamConfig.enableDonations}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, enableDonations: e.target.checked }))
                      }
                      className='mr-2 rounded'
                    />
                    <span className='text-sm'>Enable Donations</span>
                  </label>

                  <label className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={streamConfig.enableRecording}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, enableRecording: e.target.checked }))
                      }
                      className='mr-2 rounded'
                    />
                    <span className='text-sm'>Record Stream</span>
                  </label>

                  <label className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={streamConfig.isPrivate}
                      onChange={e =>
                        setStreamConfig(prev => ({ ...prev, isPrivate: e.target.checked }))
                      }
                      className='mr-2 rounded'
                    />
                    <span className='text-sm'>Private Stream</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            {/* Chat */}
            {activeStream && showChat && (
              <div className='bg-gray-800 rounded-lg'>
                <div className='p-4 border-b border-gray-700'>
                  <div className='flex items-center justify-between'>
                    <h3 className='font-semibold flex items-center gap-2'>
                      <ChatBubbleLeftRightIcon className='w-5 h-5' />
                      Live Chat
                    </h3>
                    <span className='text-sm text-gray-400'>
                      {activeStream.metadata.chatMessages} messages
                    </span>
                  </div>
                </div>

                <div className='h-64 overflow-y-auto p-4 space-y-3'>
                  {chatMessages.map(message => (
                    <div
                      key={message.id}
                      className={cn(
                        'text-sm',
                        message.type === 'system' && 'text-gray-400 italic',
                        message.type === 'donation' &&
                          'bg-yellow-600/20 p-2 rounded border border-yellow-600/30'
                      )}
                    >
                      {message.type !== 'system' && (
                        <span className='font-medium text-blue-400'>{message.userName}: </span>
                      )}
                      <span>{message.content}</span>
                      {message.metadata?.donationAmount && (
                        <span className='text-yellow-400 ml-2'>
                          (${message.metadata.donationAmount})
                        </span>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className='p-4 border-t border-gray-700'>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                      placeholder='Type a message...'
                      className='flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                    />
                    <button
                      onClick={sendChatMessage}
                      className='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm'
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stream Stats */}
            {activeStream && (
              <div className='bg-gray-800 rounded-lg p-4'>
                <h3 className='font-semibold mb-4 flex items-center gap-2'>
                  <ChartBarIcon className='w-5 h-5' />
                  Stream Stats
                </h3>

                <div className='space-y-3'>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Viewers</span>
                    <span className='font-medium'>{activeStream.metadata.currentViewers}</span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Total Views</span>
                    <span className='font-medium'>{activeStream.metadata.totalViews}</span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Donations</span>
                    <span className='font-medium text-green-400'>
                      ${activeStream.metadata.totalDonations}
                    </span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Likes</span>
                    <span className='font-medium'>{activeStream.metadata.likes}</span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Messages</span>
                    <span className='font-medium'>{activeStream.metadata.chatMessages}</span>
                  </div>
                </div>

                <div className='flex gap-2 mt-4'>
                  <button
                    onClick={sendLike}
                    className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm'
                  >
                    <HeartIcon className='w-4 h-4' />
                    Like
                  </button>

                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: activeStream.title,
                          url: window.location.href,
                        });
                      }
                    }}
                    className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm'
                  >
                    <ShareIcon className='w-4 h-4' />
                    Share
                  </button>
                </div>
              </div>
            )}

            {/* Donation Widget */}
            {activeStream && streamConfig.enableDonations && (
              <div className='bg-gray-800 rounded-lg p-4'>
                <h3 className='font-semibold mb-4 flex items-center gap-2'>
                  <CurrencyDollarIcon className='w-5 h-5' />
                  Send Donation
                </h3>

                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Amount</label>
                    <div className='flex gap-2 mb-2'>
                      {[5, 10, 25, 50].map(amount => (
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
                      rows={2}
                      className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm'
                    />
                  </div>

                  <button
                    onClick={sendDonation}
                    disabled={donationAmount <= 0}
                    className='w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium'
                  >
                    Donate ${donationAmount}
                  </button>
                </div>

                {donations.length > 0 && (
                  <div className='mt-4 border-t border-gray-700 pt-4'>
                    <h4 className='text-sm font-medium mb-2'>Recent Donations</h4>
                    <div className='space-y-2 max-h-32 overflow-y-auto'>
                      {donations.slice(0, 5).map(donation => (
                        <div key={donation.id} className='text-xs bg-gray-700 p-2 rounded'>
                          <div className='flex justify-between'>
                            <span className='font-medium'>{donation.donorName}</span>
                            <span className='text-green-400'>${donation.amount}</span>
                          </div>
                          {donation.message && (
                            <p className='text-gray-300 mt-1'>{donation.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
