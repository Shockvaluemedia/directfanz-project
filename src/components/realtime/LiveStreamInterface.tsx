'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Users, 
  Heart, 
  MessageCircle, 
  Gift, 
  Share2, 
  Settings,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  DollarSign,
  Send,
  Smile,
  MoreHorizontal,
  Eye,
  Radio,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  streamerId: string;
  streamerName: string;
  streamerAvatar?: string;
  isLive: boolean;
  viewerCount: number;
  startedAt: Date;
  category?: string;
  tags?: string[];
  streamKey?: string;
  thumbnailUrl?: string;
}

interface LiveMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'tip' | 'follow' | 'subscription' | 'system';
  amount?: number;
  isHighlighted?: boolean;
  isModerator?: boolean;
  isStreamer?: boolean;
}

interface LiveStreamInterfaceProps {
  stream: LiveStream;
  currentUserId?: string;
  isStreamer?: boolean;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onSendMessage?: (message: string) => void;
  onSendTip?: (amount: number, message?: string) => void;
  onFollow?: () => void;
  onSubscribe?: () => void;
  className?: string;
}

export function LiveStreamInterface({
  stream,
  currentUserId,
  isStreamer = false,
  onStreamStart,
  onStreamEnd,
  onSendMessage,
  onSendTip,
  onFollow,
  onSubscribe,
  className = ''
}: LiveStreamInterfaceProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(100);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // Streamer controls
  const [isStreaming, setIsStreaming] = useState(stream.isLive);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useSocket();

  // Socket event handlers
  useEffect(() => {
    if (!socket || !stream.id) return;

    // Join stream room
    socket.emit('join_stream', { streamId: stream.id, userId: currentUserId });

    // Message events
    socket.on('stream_message', (message: LiveMessage) => {
      setMessages(prev => [...prev, message].slice(-100)); // Keep last 100 messages
      scrollChatToBottom();
    });

    // Viewer count updates
    socket.on('viewer_count_update', ({ count }: { count: number }) => {
      // Update viewer count in stream state if needed
    });

    // Stream status updates
    socket.on('stream_status', ({ isLive }: { isLive: boolean }) => {
      setIsStreaming(isLive);
    });

    // Tips and donations
    socket.on('stream_tip', (tipData: { 
      userId: string, 
      userName: string, 
      amount: number, 
      message?: string 
    }) => {
      const tipMessage: LiveMessage = {
        id: `tip-${Date.now()}`,
        userId: tipData.userId,
        userName: tipData.userName,
        message: tipData.message || `Tipped $${tipData.amount}`,
        timestamp: new Date(),
        type: 'tip',
        amount: tipData.amount,
        isHighlighted: true
      };
      setMessages(prev => [...prev, tipMessage]);
    });

    // Follows and subscriptions
    socket.on('stream_follow', (userData: { userId: string, userName: string }) => {
      const followMessage: LiveMessage = {
        id: `follow-${Date.now()}`,
        userId: userData.userId,
        userName: userData.userName,
        message: `${userData.userName} followed!`,
        timestamp: new Date(),
        type: 'follow',
        isHighlighted: true
      };
      setMessages(prev => [...prev, followMessage]);
    });

    return () => {
      socket.emit('leave_stream', { streamId: stream.id, userId: currentUserId });
      socket.off('stream_message');
      socket.off('viewer_count_update');
      socket.off('stream_status');
      socket.off('stream_tip');
      socket.off('stream_follow');
    };
  }, [socket, stream.id, currentUserId]);

  // Update connection status
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  const scrollChatToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!chatMessage.trim() || !socket || !currentUserId) return;

    const message: LiveMessage = {
      id: `msg-${Date.now()}`,
      userId: currentUserId,
      userName: 'You', // This should come from user context
      message: chatMessage,
      timestamp: new Date(),
      type: 'chat'
    };

    socket.emit('stream_message', {
      streamId: stream.id,
      message: chatMessage,
      userId: currentUserId
    });

    setChatMessage('');
  }, [chatMessage, socket, currentUserId, stream.id]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleStream = () => {
    if (isStreaming) {
      onStreamEnd?.();
      setIsStreaming(false);
    } else {
      onStreamStart?.();
      setIsStreaming(true);
    }
  };

  const handleTip = (amount: number) => {
    setTipAmount(amount);
    setShowTipModal(true);
  };

  const confirmTip = () => {
    if (tipAmount && onSendTip) {
      onSendTip(tipAmount, 'Thanks for the great content!');
      setShowTipModal(false);
      setTipAmount(null);
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const MessageItem = ({ message }: { message: LiveMessage }) => {
    const getMessageStyle = () => {
      switch (message.type) {
        case 'tip':
          return 'bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800';
        case 'follow':
          return 'bg-green-50 border-l-4 border-green-400 text-green-800';
        case 'subscription':
          return 'bg-purple-50 border-l-4 border-purple-400 text-purple-800';
        case 'system':
          return 'bg-gray-50 border-l-4 border-gray-400 text-gray-600 italic';
        default:
          return message.isHighlighted ? 'bg-blue-50' : '';
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-2 rounded-lg mb-2 ${getMessageStyle()}`}
      >
        <div className="flex items-start space-x-2">
          {message.userAvatar ? (
            <img 
              src={message.userAvatar} 
              alt={message.userName}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">
                {message.userName.charAt(0)}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`font-medium text-sm ${
                message.isStreamer ? 'text-red-600' : 
                message.isModerator ? 'text-green-600' : 
                'text-gray-900'
              }`}>
                {message.userName}
                {message.isStreamer && ' 👑'}
                {message.isModerator && ' ⚡'}
              </span>
              {message.amount && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  ${message.amount}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {message.timestamp.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            <p className="text-sm text-gray-700 break-words">
              {message.message}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      <div className="relative aspect-video bg-gray-900">
        {/* Video Player */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted={isMuted}
          controls={false}
          playsInline
        />

        {/* Stream Status Overlay */}
        <div className="absolute top-4 left-4 flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
            isStreaming ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-white animate-pulse' : 'bg-gray-500'
            }`} />
            {isStreaming ? 'LIVE' : 'OFFLINE'}
          </div>
          
          {isStreaming && (
            <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              {formatDuration(stream.startedAt)}
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="absolute top-4 right-4">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' ? 'bg-green-500 text-white' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 text-white' :
            'bg-red-500 text-white'
          }`}>
            {connectionStatus === 'connected' && <CheckCircle className="w-4 h-4" />}
            {connectionStatus === 'connecting' && <AlertCircle className="w-4 h-4" />}
            {connectionStatus === 'disconnected' && <AlertCircle className="w-4 h-4" />}
            {connectionStatus}
          </div>
        </div>

        {/* Viewer Count */}
        <div className="absolute bottom-4 left-4 flex items-center space-x-4">
          <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>{stream.viewerCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Player Controls */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-2">
          <motion.button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </motion.button>
          
          <motion.button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </motion.button>
          
          <motion.button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </motion.button>
        </div>

        {/* Streamer Controls */}
        {isStreamer && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="flex items-center space-x-2 bg-black bg-opacity-70 rounded-full px-4 py-2">
              <motion.button
                onClick={toggleStream}
                className={`p-2 rounded-full ${
                  isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                } text-white transition-colors`}
                whileTap={{ scale: 0.9 }}
              >
                <Radio className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={() => setIsMicEnabled(!isMicEnabled)}
                className={`p-2 rounded-full ${
                  isMicEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-500 hover:bg-red-600'
                } text-white transition-colors`}
                whileTap={{ scale: 0.9 }}
              >
                {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </motion.button>
              
              <motion.button
                onClick={() => setIsCameraEnabled(!isCameraEnabled)}
                className={`p-2 rounded-full ${
                  isCameraEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-500 hover:bg-red-600'
                } text-white transition-colors`}
                whileTap={{ scale: 0.9 }}
              >
                {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </motion.button>
              
              <motion.button
                onClick={() => setIsScreenSharing(!isScreenSharing)}
                className={`p-2 rounded-full ${
                  isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'
                } text-white transition-colors`}
                whileTap={{ scale: 0.9 }}
              >
                {isScreenSharing ? <Monitor className="w-4 h-4" /> : <MonitorOff className="w-4 h-4" />}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className={`bg-gray-900 transition-all duration-300 ${
        isChatMinimized ? 'h-12' : 'h-80'
      }`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-5 h-5 text-gray-400" />
            <h3 className="text-white font-medium">Live Chat</h3>
            <span className="text-gray-400 text-sm">
              ({messages.length} messages)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isStreamer && (
              <div className="flex space-x-1">
                {[5, 10, 25, 50].map(amount => (
                  <motion.button
                    key={amount}
                    onClick={() => handleTip(amount)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-medium hover:bg-yellow-600 transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    ${amount}
                  </motion.button>
                ))}
              </div>
            )}
            
            <motion.button
              onClick={() => setIsChatMinimized(!isChatMinimized)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {!isChatMinimized && (
          <>
            {/* Messages */}
            <div className="h-48 overflow-y-auto p-3 space-y-1">
              <AnimatePresence>
                {messages.map(message => (
                  <MessageItem key={message.id} message={message} />
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Say something..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <motion.button
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <Smile className="w-5 h-5" />
                </motion.button>
                
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  className={`p-2 rounded-lg transition-colors ${
                    chatMessage.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tip Modal */}
      <AnimatePresence>
        {showTipModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-sm mx-4"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Send Tip
                </h3>
                <p className="text-gray-600 mb-6">
                  Send ${tipAmount} to {stream.streamerName}?
                </p>
                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => setShowTipModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={confirmTip}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    Send Tip
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}