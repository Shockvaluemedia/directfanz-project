'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Message, User, ConnectionStatus } from '@/types/websocket';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { ConnectionIndicator } from './ConnectionIndicator';
import { UserPresenceIndicator } from './UserPresenceIndicator';

interface RealTimeChatProps {
  otherUser: User;
  initialMessages?: Message[];
  onMessageSent?: (message: Message) => void;
  className?: string;
}

export function RealTimeChat({ 
  otherUser, 
  initialMessages = [], 
  onMessageSent,
  className = ''
}: RealTimeChatProps) {
  const { data: session } = useSession();
  const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    connectionStatus,
    isConnected,
    error,
    sendMessage,
    markMessageAsRead,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    messages: realtimeMessages,
    typingUsers,
    onlineUsers,
    on,
    off,
  } = useWebSocket();

  const currentUserId = session?.user?.id;
  const conversationTypingUsers = typingUsers.filter(
    user => user.userId === otherUser.id || user.userId === currentUserId
  );
  
  const isOtherUserOnline = onlineUsers.includes(otherUser.id);
  const isOtherUserTyping = conversationTypingUsers.some(user => user.userId === otherUser.id);

  // Join conversation when component mounts and user is connected
  useEffect(() => {
    if (isConnected && otherUser.id) {
      joinConversation(otherUser.id);
    }

    return () => {
      if (otherUser.id) {
        leaveConversation(otherUser.id);
      }
    };
  }, [isConnected, otherUser.id, joinConversation, leaveConversation]);

  // Handle real-time messages
  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      // Only add messages for this conversation
      if (
        (message.senderId === currentUserId && message.recipientId === otherUser.id) ||
        (message.senderId === otherUser.id && message.recipientId === currentUserId)
      ) {
        setAllMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });

        // Auto-mark as read if message is from other user
        if (message.senderId === otherUser.id && message.recipientId === currentUserId) {
          markMessageAsRead(message.id);
        }

        if (onMessageSent) {
          onMessageSent(message);
        }
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string; readBy: string }) => {
      setAllMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, readAt: data.readAt }
            : msg
        )
      );
    };

    const handleMessageDelivered = (data: { messageId: string; deliveredAt: string }) => {
      setAllMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, deliveredAt: data.deliveredAt }
            : msg
        )
      );
    };

    if (isConnected) {
      on('message:new', handleNewMessage);
      on('message:read', handleMessageRead);
      on('message:delivered', handleMessageDelivered);
    }

    return () => {
      if (isConnected) {
        off('message:new', handleNewMessage);
        off('message:read', handleMessageRead);
        off('message:delivered', handleMessageDelivered);
      }
    };
  }, [isConnected, currentUserId, otherUser.id, markMessageAsRead, onMessageSent, on, off]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [allMessages, isOtherUserTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = useCallback(async (content: string, type?: 'TEXT' | 'IMAGE' | 'AUDIO', attachmentUrl?: string) => {
    if (!content.trim() || !isConnected) return;

    try {
      sendMessage(otherUser.id, content.trim(), type, attachmentUrl);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [sendMessage, otherUser.id, isConnected]);

  const handleStartTyping = useCallback(() => {
    if (!isConnected) return;
    
    setIsTyping(true);
    startTyping(otherUser.id);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  }, [startTyping, otherUser.id, isConnected]);

  const handleStopTyping = useCallback(() => {
    if (!isConnected) return;
    
    setIsTyping(false);
    stopTyping(otherUser.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [stopTyping, otherUser.id, isConnected]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please log in to chat</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={otherUser.avatar || '/default-avatar.png'}
              alt={otherUser.displayName}
              className="w-10 h-10 rounded-full"
            />
            <UserPresenceIndicator
              isOnline={isOtherUserOnline}
              className="absolute -bottom-1 -right-1"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {otherUser.displayName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOtherUserOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        
        <ConnectionIndicator status={connectionStatus} error={error} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={allMessages}
          currentUserId={currentUserId}
          onMessageRead={markMessageAsRead}
        />
        
        {/* Typing Indicator */}
        {isOtherUserTyping && (
          <TypingIndicator
            user={otherUser}
            className="px-4 pb-2"
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <MessageInput
          onSendMessage={handleSendMessage}
          onStartTyping={handleStartTyping}
          onStopTyping={handleStopTyping}
          disabled={!isConnected}
          placeholder={
            !isConnected 
              ? 'Connecting...' 
              : `Message ${otherUser.displayName}...`
          }
        />
      </div>
    </div>
  );
}