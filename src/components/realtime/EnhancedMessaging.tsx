'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  Image, 
  Smile, 
  MoreHorizontal, 
  Phone, 
  Video,
  Heart,
  ThumbsUp,
  MessageCircle,
  Eye,
  Wifi,
  WifiOff,
  Clock,
  Check,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'system';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: { [emoji: string]: string[] }; // emoji -> userIds
  isEdited?: boolean;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
}

interface TypingIndicator {
  userId: string;
  userName: string;
  timestamp: Date;
}

interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
}

interface EnhancedMessagingProps {
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  messages: Message[];
  participants: {
    id: string;
    name: string;
    avatar?: string;
    presence: UserPresence['status'];
    lastSeen?: Date;
  }[];
  onSendMessage: (content: string, type: Message['type'], replyTo?: string) => Promise<void>;
  onReactToMessage: (messageId: string, emoji: string) => Promise<void>;
  onMarkAsRead: (messageIds: string[]) => Promise<void>;
  className?: string;
}

const commonEmojis = ['❤️', '👍', '😂', '😮', '😢', '😠', '🔥', '👏'];

export function EnhancedMessaging({
  conversationId,
  currentUserId,
  currentUserName,
  messages,
  participants,
  onSendMessage,
  onReactToMessage,
  onMarkAsRead,
  className = ''
}: EnhancedMessagingProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  const { socket, isConnected } = useSocket();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connection status
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Typing indicators
    const handleTypingStart = ({ userId, userName }: { userId: string, userName: string }) => {
      if (userId === currentUserId) return;

      setTypingUsers(prev => {
        const filtered = prev.filter(t => t.userId !== userId);
        return [...filtered, { userId, userName, timestamp: new Date() }];
      });
    };

    const handleTypingStop = ({ userId }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(t => t.userId !== userId));
    };

    // Message status updates
    const handleMessageDelivered = ({ messageId }: { messageId: string }) => {
      // Update message status in local state
    };

    const handleMessageRead = ({ messageIds }: { messageIds: string[] }) => {
      // Update message status in local state
    };

    // Presence updates
    const handlePresenceUpdate = ({ userId, status, lastSeen }: UserPresence) => {
      // Update participant presence
    };

    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('message_read', handleMessageRead);
    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
      socket.off('message_delivered', handleMessageDelivered);
      socket.off('message_read', handleMessageRead);
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [socket, currentUserId]);

  // Clean up old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTypingUsers(prev => 
        prev.filter(t => now.getTime() - t.timestamp.getTime() < 3000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!socket || !isConnected) return;

    const now = Date.now();
    const shouldEmit = now - lastTypingEmitRef.current > 1000; // Throttle to 1 second

    if (shouldEmit) {
      socket.emit('typing_start', {
        conversationId,
        userId: currentUserId,
        userName: currentUserName
      });
      lastTypingEmitRef.current = now;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', {
        conversationId,
        userId: currentUserId
      });
    }, 2000);
  }, [socket, isConnected, conversationId, currentUserId, currentUserName]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !isConnected) return;

    try {
      await onSendMessage(newMessage, 'text', replyTo?.id);
      setNewMessage('');
      setReplyTo(null);
      
      // Stop typing indicator
      if (socket) {
        socket.emit('typing_stop', {
          conversationId,
          userId: currentUserId
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [newMessage, isConnected, onSendMessage, replyTo, socket, conversationId, currentUserId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const getMessageStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const MessageItem = ({ message }: { message: Message }) => {
    const isOwn = message.senderId === currentUserId;
    const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
          {/* Reply indicator */}
          {message.replyTo && (
            <div className="mb-2 p-2 bg-gray-100 rounded-lg border-l-4 border-indigo-500">
              <p className="text-xs text-gray-600 font-medium">{message.replyTo.senderName}</p>
              <p className="text-sm text-gray-800 truncate">{message.replyTo.content}</p>
            </div>
          )}

          {/* Message bubble */}
          <div
            className={`relative px-4 py-2 rounded-2xl shadow-sm ${
              isOwn
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-white text-gray-900 rounded-bl-md'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            
            {message.isEdited && (
              <span className={`text-xs ${isOwn ? 'text-indigo-200' : 'text-gray-500'}`}>
                (edited)
              </span>
            )}

            {/* Message actions */}
            <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex space-x-1">
                <motion.button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                  className="p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <Smile className="w-3 h-3 text-gray-600" />
                </motion.button>
                <motion.button
                  onClick={() => setReplyTo(message)}
                  className="p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <MessageCircle className="w-3 h-3 text-gray-600" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Reactions */}
          {hasReactions && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(message.reactions!).map(([emoji, userIds]) => (
                <motion.button
                  key={emoji}
                  onClick={() => onReactToMessage(message.id, emoji)}
                  className={`flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full text-xs transition-colors ${
                    userIds.includes(currentUserId) ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-200'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </motion.button>
              ))}
            </div>
          )}

          {/* Emoji picker */}
          <AnimatePresence>
            {showEmojiPicker === message.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute z-10 mt-2 bg-white rounded-lg shadow-large border border-gray-200 p-2 flex space-x-2"
              >
                {commonEmojis.map(emoji => (
                  <motion.button
                    key={emoji}
                    onClick={() => {
                      onReactToMessage(message.id, emoji);
                      setShowEmojiPicker(null);
                    }}
                    className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center text-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message metadata */}
          <div className={`flex items-center space-x-2 mt-1 text-xs ${
            isOwn ? 'justify-end text-gray-400' : 'justify-start text-gray-500'
          }`}>
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && getMessageStatusIcon(message.status)}
          </div>
        </div>

        {/* Avatar */}
        {!isOwn && (
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
            {message.senderAvatar ? (
              <img 
                src={message.senderAvatar} 
                alt={message.senderName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-medium text-sm">
                {message.senderName.charAt(0)}
              </span>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const TypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    const names = typingUsers.map(t => t.userName);
    const displayText = names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names[0]} and ${names.length - 1} others are typing...`;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="flex items-center space-x-3 mb-4"
      >
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <MessageCircle className="w-4 h-4 text-gray-500" />
          </motion.div>
        </div>
        <div className="bg-gray-100 rounded-2xl px-4 py-2">
          <p className="text-sm text-gray-600 italic">{displayText}</p>
          <div className="flex space-x-1 mt-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-gray-400 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const ConnectionStatus = () => (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
      connectionStatus === 'connected'
        ? 'bg-green-100 text-green-700'
        : connectionStatus === 'connecting'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'
    }`}>
      {connectionStatus === 'connected' ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span>
        {connectionStatus === 'connected' && 'Online'}
        {connectionStatus === 'connecting' && 'Connecting...'}
        {connectionStatus === 'disconnected' && 'Offline'}
      </span>
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex -space-x-2">
              {participants.slice(0, 3).map(participant => (
                <div
                  key={participant.id}
                  className="relative w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center border-2 border-white"
                >
                  {participant.avatar ? (
                    <img 
                      src={participant.avatar} 
                      alt={participant.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-medium text-xs">
                      {participant.name.charAt(0)}
                    </span>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
                    participant.presence === 'online' ? 'bg-green-500' :
                    participant.presence === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {participants.map(p => p.name).join(', ')}
              </h3>
              <p className="text-sm text-gray-500">
                {participants.filter(p => p.presence === 'online').length} online
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ConnectionStatus />
            <div className="flex space-x-2">
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <Phone className="w-5 h-5 text-gray-600" />
              </motion.button>
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <Video className="w-5 h-5 text-gray-600" />
              </motion.button>
              <motion.button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <MoreHorizontal className="w-5 h-5 text-gray-600" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(message => (
          <div key={message.id} className="group">
            <MessageItem message={message} />
          </div>
        ))}
        
        <AnimatePresence>
          <TypingIndicator />
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-3 bg-gray-100 border-t border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-1 h-8 bg-indigo-500 rounded-full" />
                <div>
                  <p className="text-xs font-medium text-gray-600">
                    Replying to {replyTo.senderName}
                  </p>
                  <p className="text-sm text-gray-800 truncate max-w-md">
                    {replyTo.content}
                  </p>
                </div>
              </div>
              <motion.button
                onClick={() => setReplyTo(null)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <AlertCircle className="w-4 h-4 text-gray-500" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-4">
          <div className="flex space-x-2">
            <motion.button
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <Image className="w-5 h-5" />
            </motion.button>
            <motion.button
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <Mic className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          <motion.button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className={`p-2 rounded-full transition-colors ${
              newMessage.trim() && isConnected
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}