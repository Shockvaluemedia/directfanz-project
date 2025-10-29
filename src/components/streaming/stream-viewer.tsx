'use client';

import React, { useState, useRef, useEffect } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { useStreaming } from '@/contexts/streaming-context';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Heart,
  Gift,
  Share2,
  Users,
  Send,
  MoreVertical,
  Flag,
  DollarSign,
  Circle,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface StreamViewerProps {
  streamId: string;
  className?: string;
}

export function StreamViewer({ streamId, className }: StreamViewerProps) {
  const {
    remoteStream,
    currentStream,
    isViewing,
    messages,
    onlineViewers,
    joinStream,
    leaveStream,
    sendMessage,
    sendTip
  } = useStreaming();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipMessage, setTipMessage] = useState('');
  const [volume, setVolume] = useState(100);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Set up video stream
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Join stream on mount
  useEffect(() => {
    if (streamId && !isViewing) {
      joinStream(streamId);
    }

    return () => {
      if (isViewing) {
        leaveStream();
      }
    };
  }, [streamId]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlayPause = () => {
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
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  const toggleFullscreen = async () => {
    if (!streamContainerRef.current) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await streamContainerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      sendMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handleSendTip = () => {
    if (tipAmount > 0) {
      sendTip(tipAmount, tipMessage);
      setShowTipModal(false);
      setTipAmount(5);
      setTipMessage('');
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return format(timestamp, 'HH:mm');
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'tip':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'follow':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'subscription':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'system':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return '';
    }
  };

  if (!currentStream) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">Stream not found</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-screen", className)}>
      {/* Video Player */}
      <div className="lg:col-span-2">
        <div ref={streamContainerRef} className={cn("relative bg-black rounded-lg overflow-hidden", isFullscreen && "fixed inset-0 z-50 rounded-none")}>
          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.volume = volume / 100;
              }
            }}
          />

          {/* Video Controls Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/50 opacity-0 hover:opacity-100 transition-opacity duration-300 group">
            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium">
                  <Circle className="w-2 h-2 fill-current animate-pulse" />
                  LIVE
                </div>
                <div className="px-3 py-1 bg-black/50 text-white rounded-full text-sm backdrop-blur-sm">
                  <Eye className="w-4 h-4 inline mr-1" />
                  {currentStream.viewerCount} viewers
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <EnhancedButton
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-black/50"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </EnhancedButton>
              </div>
            </div>

            {/* Center Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <EnhancedButton
                variant="ghost"
                size="lg"
                onClick={togglePlayPause}
                className="text-white hover:bg-black/50 rounded-full w-16 h-16"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
              </EnhancedButton>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-white">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-lg">{currentStream.title}</h3>
                    <p className="text-sm opacity-75">{currentStream.streamerName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Volume Control */}
                  <div className="flex items-center gap-2">
                    <EnhancedButton
                      variant="ghost"
                      size="sm"
                      onClick={toggleMute}
                      className="text-white hover:bg-black/50"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </EnhancedButton>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stream Info */}
          {!isFullscreen && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4">
              <div className="flex justify-between items-end">
                <div className="text-white">
                  <h2 className="text-xl font-bold">{currentStream.title}</h2>
                  <p className="text-sm opacity-75">{currentStream.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span>{currentStream.category}</span>
                    <span>{currentStream.tags.join(', ')}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <EnhancedButton
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    <Heart className="w-4 h-4 mr-1" />
                    Follow
                  </EnhancedButton>
                  <EnhancedButton
                    variant="primary"
                    size="sm"
                    onClick={() => setShowTipModal(true)}
                  >
                    <Gift className="w-4 h-4 mr-1" />
                    Tip
                  </EnhancedButton>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stream Actions (Below Video) */}
        {!isFullscreen && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={currentStream.streamerAvatar}
                alt={currentStream.streamerName}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold">{currentStream.streamerName}</h3>
                <p className="text-sm text-gray-600">
                  Started {format(currentStream.startedAt, 'MMM d, yyyy • h:mm a')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <EnhancedButton variant="ghost" size="sm">
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </EnhancedButton>
              <EnhancedButton variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </EnhancedButton>
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {!isFullscreen && (
        <div className="flex flex-col h-full">
          <EnhancedCard variant="elevated" className="flex-1 flex flex-col min-h-0">
            <EnhancedCardHeader className="border-b border-gray-200">
              <EnhancedCardTitle className="flex items-center justify-between">
                <span>Live Chat</span>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  {onlineViewers.length} online
                </div>
              </EnhancedCardTitle>
            </EnhancedCardHeader>
            
            <EnhancedCardContent className="flex-1 flex flex-col min-h-0 p-0">
              {/* Messages */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
              >
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 text-sm",
                      message.isHighlighted && "p-2 rounded-lg border",
                      getMessageTypeColor(message.type)
                    )}
                  >
                    <img
                      src={message.avatar}
                      alt={message.username}
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "font-medium",
                          message.isStreamer && "text-red-600",
                          message.isModerator && "text-blue-600"
                        )}>
                          {message.username}
                        </span>
                        {message.type === 'tip' && message.amount && (
                          <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                            ${message.amount}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatMessageTime(message.timestamp)}
                        </span>
                      </div>
                      <p className="break-words">{message.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Chat Input */}
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Say something..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <EnhancedButton type="submit" variant="primary" size="sm">
                    <Send className="w-4 h-4" />
                  </EnhancedButton>
                </form>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Send a Tip</h3>
              <p className="text-gray-600">Support {currentStream.streamerName}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount ($)
                </label>
                <div className="flex gap-2 mb-3">
                  {[5, 10, 25, 50].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setTipAmount(amount)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-sm font-medium",
                        tipAmount === amount
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                      )}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(parseInt(e.target.value) || 0)}
                  min="1"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={tipMessage}
                  onChange={(e) => setTipMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a message with your tip..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <EnhancedButton
                variant="ghost"
                onClick={() => setShowTipModal(false)}
                className="flex-1"
              >
                Cancel
              </EnhancedButton>
              <EnhancedButton
                variant="primary"
                onClick={handleSendTip}
                className="flex-1"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Send ${tipAmount}
              </EnhancedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}