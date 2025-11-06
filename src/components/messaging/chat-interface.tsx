'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket, Message, Conversation, TypingUser } from '@/contexts/socket-context';
import { useSession } from 'next-auth/react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Video, 
  MoreHorizontal,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Music,
  Crown,
  Circle
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  conversation: Conversation | null;
  className?: string;
}

export function ChatInterface({ conversation, className }: ChatInterfaceProps) {
  const { data: session } = useSession();
  const { 
    messages, 
    sendMessage, 
    joinConversation, 
    leaveConversation,
    startTyping,
    stopTyping,
    markMessagesAsRead,
    getConversationHistory,
    typingUsers,
    isConnected 
  } = useSocket();
  
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const conversationMessages = conversation 
    ? messages[conversation.conversationId] || []
    : [];

  const participant = conversation?.participants[0];

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages, scrollToBottom]);

  // Join/leave conversation when selection changes
  useEffect(() => {
    if (conversation) {
      joinConversation(conversation.conversationId);
      getConversationHistory(conversation.conversationId);

      return () => {
        leaveConversation(conversation.conversationId);
      };
    }
  }, [conversation, joinConversation, leaveConversation, getConversationHistory]);

  // Mark messages as read when conversation is viewed
  useEffect(() => {
    if (conversation && conversationMessages.length > 0) {
      const unreadMessages = conversationMessages
        .filter(msg => msg.receiverId === session?.user?.id && !msg.read)
        .map(msg => msg.id);
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(conversation.conversationId, unreadMessages);
      }
    }
  }, [conversation, conversationMessages, session?.user?.id, markMessagesAsRead]);

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isTyping && conversation && participant) {
      setIsTyping(true);
      startTyping(conversation.conversationId, participant.userId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (conversation && participant) {
        setIsTyping(false);
        stopTyping(conversation.conversationId, participant.userId);
      }
    }, 3000);
  }, [isTyping, conversation, participant, startTyping, stopTyping]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !conversation || !participant) return;

    sendMessage(participant.userId, messageText.trim(), 'text', conversation.conversationId);
    setMessageText('');

    // Stop typing
    if (isTyping) {
      setIsTyping(false);
      stopTyping(conversation.conversationId, participant.userId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    // Focus back to input
    messageInputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageStatus = (message: Message) => {
    if (message.senderId !== session?.user?.id) return null;

    if (message.status === 'sending') {
      return <Clock className="w-3 h-3 text-gray-400" />;
    }
    
    if (message.read) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    
    return <Check className="w-3 h-3 text-gray-400" />;
  };

  const formatMessageTime = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return format(timestamp, 'HH:mm');
    } else if (isYesterday(timestamp)) {
      return 'Yesterday ' + format(timestamp, 'HH:mm');
    } else {
      return format(timestamp, 'MMM d, HH:mm');
    }
  };

  const getTypingIndicator = () => {
    if (!conversation) return null;
    
    const typingInConversation = typingUsers.filter(
      user => user.conversationId === conversation.conversationId
    );

    if (typingInConversation.length === 0) return null;

    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        </div>
        <span className="text-sm text-gray-500">
          {typingInConversation[0].username} is typing...
        </span>
      </div>
    );
  };

  if (!conversation) {
    return (
      <EnhancedCard variant="elevated" className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center">
          <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Select a conversation</h3>
          <p className="text-gray-500">Choose a conversation from the left to start messaging</p>
        </div>
      </EnhancedCard>
    );
  }

  return (
    <EnhancedCard variant="elevated" className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <EnhancedCardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white",
                participant?.role === 'ARTIST' ? 'bg-purple-500' : 'bg-blue-500'
              )}>
                {participant?.username.charAt(0).toUpperCase()}
              </div>
              
              {participant?.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {participant?.username}
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                  participant?.role === 'ARTIST' 
                    ? 'text-purple-600 bg-purple-100'
                    : 'text-blue-600 bg-blue-100'
                )}>
                  {participant?.role === 'ARTIST' ? <Music className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                  {participant?.role}
                </div>
              </h3>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Circle className={cn(
                  "w-2 h-2 rounded-full",
                  participant?.isOnline ? "text-green-500 fill-green-500" : "text-gray-400 fill-gray-400"
                )} />
                {participant?.isOnline ? 'Online' : 'Offline'}
                {!isConnected && (
                  <span className="text-red-500">• Disconnected</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <EnhancedButton variant="ghost" size="sm">
              <Phone className="w-4 h-4" />
            </EnhancedButton>
            <EnhancedButton variant="ghost" size="sm">
              <Video className="w-4 h-4" />
            </EnhancedButton>
            <EnhancedButton variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </EnhancedButton>
          </div>
        </div>
      </EnhancedCardHeader>

      {/* Messages */}
      <EnhancedCardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {conversationMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Start your conversation!</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {conversationMessages.map((message, index) => {
                const isOwnMessage = message.senderId === session?.user?.id;
                const showAvatar = index === 0 || 
                  conversationMessages[index - 1].senderId !== message.senderId;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      isOwnMessage ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {showAvatar ? (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-sm",
                          isOwnMessage ? 'bg-indigo-500' : 
                          message.senderRole === 'ARTIST' ? 'bg-purple-500' : 'bg-blue-500'
                        )}>
                          {message.senderUsername.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>

                    {/* Message */}
                    <div className={cn(
                      "max-w-xs lg:max-w-md",
                      isOwnMessage ? "items-end" : "items-start"
                    )}>
                      {showAvatar && !isOwnMessage && (
                        <p className="text-xs text-gray-500 mb-1">
                          {message.senderUsername}
                        </p>
                      )}
                      
                      <div className={cn(
                        "px-4 py-2 rounded-2xl",
                        isOwnMessage 
                          ? "bg-indigo-500 text-white" 
                          : "bg-gray-100 text-gray-900"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>

                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs text-gray-500",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}>
                        <span>{formatMessageTime(message.timestamp)}</span>
                        {getMessageStatus(message)}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {getTypingIndicator()}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </EnhancedCardContent>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end gap-3">
          <EnhancedButton variant="ghost" size="sm" className="mb-2">
            <Paperclip className="w-4 h-4" />
          </EnhancedButton>

          <div className="flex-1">
            <textarea
              ref={messageInputRef}
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTypingStart();
              }}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${participant?.username}...`}
              disabled={!isConnected}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={1}
              style={{
                minHeight: '40px',
                maxHeight: '120px',
                height: 'auto',
              }}
            />
          </div>

          <EnhancedButton variant="ghost" size="sm" className="mb-2">
            <Smile className="w-4 h-4" />
          </EnhancedButton>

          <EnhancedButton
            onClick={handleSendMessage}
            disabled={!messageText.trim() || !isConnected}
            className="mb-2"
            size="sm"
          >
            <Send className="w-4 h-4" />
          </EnhancedButton>
        </div>

        {!isConnected && (
          <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
            <AlertCircle className="w-4 h-4" />
            Reconnecting...
          </div>
        )}
      </div>
    </EnhancedCard>
  );
}