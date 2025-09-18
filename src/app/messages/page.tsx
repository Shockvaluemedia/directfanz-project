"use client"

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ChatBubbleLeftIcon, UserIcon } from '@heroicons/react/24/outline'
import ChatInterface from '@/components/messaging/chat-interface'
import { LoadingState, LoadingSpinner, SkeletonCard } from '@/components/ui/loading'
import { useApi } from '@/hooks/use-api'

interface ConversationPreview {
  id: string
  participants: Array<{
    id: string
    displayName: string
    avatar?: string
    role: string
  }>
  lastMessage?: {
    id: string
    content: string
    senderId: string
    createdAt: string
  }
  unreadCount: number
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  // This would need a conversations API endpoint
  const {
    data: conversationsResponse,
    loading: loadingConversations,
    error: conversationsError
  } = useApi<{
    conversations: ConversationPreview[]
  }>('/api/messages/conversations', {
    immediate: true
  })

  const conversations = conversationsResponse?.conversations || []

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access messages</p>
          <Link
            href="/auth/signin"
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const formatLastMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getOtherParticipant = (conversation: ConversationPreview) => {
    return conversation.participants.find(p => p.id !== session?.user.id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex h-screen">
          {/* Conversations Sidebar */}
          <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ChatBubbleLeftIcon className="w-7 h-7 mr-2 text-indigo-600" />
                  Messages
                </h1>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              <LoadingState
                loading={loadingConversations}
                fallback={
                  <div className="p-4 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonCard key={i} lines={2} />
                    ))}
                  </div>
                }
              >
                {conversationsError ? (
                  <div className="p-6 text-center">
                    <p className="text-red-600 mb-2">Failed to load conversations</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      Try again
                    </button>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <ChatBubbleLeftIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium mb-2">No conversations yet</p>
                    <p className="text-sm">
                      {session?.user.role === 'FAN' 
                        ? 'Subscribe to artists to start messaging them'
                        : 'Fans will be able to message you when they subscribe'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {conversations.map((conversation) => {
                      const otherParticipant = getOtherParticipant(conversation)
                      const isSelected = selectedConversation === otherParticipant?.id
                      
                      return (
                        <button
                          key={conversation.id}
                          onClick={() => setSelectedConversation(otherParticipant?.id || null)}
                          className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Avatar */}
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              {otherParticipant?.avatar ? (
                                <img
                                  src={otherParticipant.avatar}
                                  alt={otherParticipant.displayName}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <UserIcon className="w-6 h-6 text-gray-400" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className={`font-medium truncate ${
                                  conversation.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                                }`}>
                                  {otherParticipant?.displayName}
                                  <span className="ml-2 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                    {otherParticipant?.role}
                                  </span>
                                </p>
                                {conversation.lastMessage && (
                                  <span className="text-xs text-gray-500 flex-shrink-0">
                                    {formatLastMessageTime(conversation.lastMessage.createdAt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <p className={`text-sm truncate ${
                                  conversation.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                                }`}>
                                  {conversation.lastMessage ? (
                                    conversation.lastMessage.content
                                  ) : (
                                    <span className="italic">No messages yet</span>
                                  )}
                                </p>
                                {conversation.unreadCount > 0 && (
                                  <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </LoadingState>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <ChatInterface
                conversationWith={selectedConversation}
                onClose={() => setSelectedConversation(null)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <ChatBubbleLeftIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a conversation
                  </h3>
                  <p>Choose a conversation from the sidebar to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}