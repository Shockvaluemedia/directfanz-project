'use client';

import React, { useState, useMemo } from 'react';
import { useSocket, Conversation } from '@/contexts/socket-context';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  MessageCircle, 
  Search, 
  Users, 
  Music, 
  Crown, 
  Clock,
  Badge,
  Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConversationsListProps {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
  className?: string;
}

export function ConversationsList({ 
  onSelectConversation, 
  selectedConversationId,
  className 
}: ConversationsListProps) {
  const { conversations, isConnected, refreshConversations } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'artists' | 'fans'>('all');

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Filter by user type
    if (filterType !== 'all') {
      filtered = filtered.filter(conv =>
        conv.participants.some(p => 
          filterType === 'artists' ? p.role === 'ARTIST' : p.role === 'FAN'
        )
      );
    }

    // Search by username or last message
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv =>
        conv.participants.some(p => p.username.toLowerCase().includes(query)) ||
        conv.lastMessage?.content.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }, [conversations, searchQuery, filterType]);

  const getParticipantInfo = (conversation: Conversation) => {
    // Get the first participant (assuming it's 1-on-1 conversations for now)
    return conversation.participants[0];
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ARTIST':
        return <Music className="w-3 h-3" />;
      case 'FAN':
        return <Crown className="w-3 h-3" />;
      default:
        return <Users className="w-3 h-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ARTIST':
        return 'text-purple-600 bg-purple-100';
      case 'FAN':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatLastMessageTime = (timestamp: Date) => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  const truncateMessage = (message: string, maxLength: number = 50) => {
    return message.length > maxLength 
      ? `${message.substring(0, maxLength)}...` 
      : message;
  };

  return (
    <EnhancedCard variant="elevated" className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <EnhancedCardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <EnhancedCardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Messages
            {!isConnected && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </EnhancedCardTitle>
          
          <EnhancedButton
            variant="ghost"
            size="sm"
            onClick={refreshConversations}
            disabled={!isConnected}
          >
            <MessageCircle className="w-4 h-4" />
          </EnhancedButton>
        </div>

        {/* Search and Filter */}
        <div className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'artists', 'fans'] as const).map((filter) => (
              <EnhancedButton
                key={filter}
                variant={filterType === filter ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(filter)}
                className="flex-1 text-xs"
              >
                {filter === 'all' && <Users className="w-3 h-3 mr-1" />}
                {filter === 'artists' && <Music className="w-3 h-3 mr-1" />}
                {filter === 'fans' && <Crown className="w-3 h-3 mr-1" />}
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </EnhancedButton>
            ))}
          </div>
        </div>
      </EnhancedCardHeader>

      {/* Conversations List */}
      <EnhancedCardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {!isConnected ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <LoadingSpinner size="sm" />
                <p className="text-sm text-gray-500 mt-2">Connecting...</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {conversations.length === 0 ? 'No conversations yet' : 'No matching conversations'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conversation) => {
                const participant = getParticipantInfo(conversation);
                const isSelected = selectedConversationId === conversation.conversationId;
                
                return (
                  <div
                    key={conversation.conversationId}
                    onClick={() => onSelectConversation(conversation)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50",
                      "border border-transparent hover:border-gray-200",
                      isSelected && "bg-indigo-50 border-indigo-200 hover:bg-indigo-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white",
                          participant.role === 'ARTIST' ? 'bg-purple-500' : 'bg-blue-500'
                        )}>
                          {participant.username.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Online indicator */}
                        {participant.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                        )}
                        
                        {/* Unread badge */}
                        {conversation.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={cn(
                            "font-semibold text-sm truncate",
                            isSelected ? "text-indigo-900" : "text-gray-900"
                          )}>
                            {participant.username}
                          </h4>
                          
                          <div className="flex items-center gap-1">
                            <div className={cn(
                              "px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                              getRoleColor(participant.role)
                            )}>
                              {getRoleIcon(participant.role)}
                              {participant.role}
                            </div>
                          </div>
                        </div>

                        {/* Last message */}
                        {conversation.lastMessage && (
                          <p className={cn(
                            "text-sm truncate mb-1",
                            isSelected ? "text-indigo-700" : "text-gray-600"
                          )}>
                            {conversation.lastMessage.type === 'text' 
                              ? truncateMessage(conversation.lastMessage.content)
                              : `📎 ${conversation.lastMessage.type.toUpperCase()}`
                            }
                          </p>
                        )}

                        {/* Time and status */}
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-xs flex items-center gap-1",
                            isSelected ? "text-indigo-600" : "text-gray-500"
                          )}>
                            <Clock className="w-3 h-3" />
                            {formatLastMessageTime(conversation.lastActivity)}
                          </span>
                          
                          {!participant.isOnline && (
                            <span className="text-xs text-gray-400">offline</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}