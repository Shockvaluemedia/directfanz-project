'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { PaperAirplaneIcon, PhotoIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { useApi, useApiMutation } from '@/hooks/use-api';
import { LoadingState, LoadingSpinner } from '@/components/ui/loading';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO';
  attachmentUrl?: string;
  createdAt: string;
  readAt?: string;
  sender: {
    id: string;
    displayName: string;
    avatar?: string;
  };
}

interface Conversation {
  id: string;
  participants: Array<{
    id: string;
    displayName: string;
    avatar?: string;
  }>;
  lastMessage?: Message;
  unreadCount: number;
}

interface ChatInterfaceProps {
  conversationWith: string;
  onClose?: () => void;
}

export default function ChatInterface({ conversationWith, onClose }: ChatInterfaceProps) {
  const { data: session } = useSession();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const {
    data: messagesResponse,
    loading: loadingMessages,
    error: messagesError,
    execute: fetchMessages,
  } = useApi<{
    messages: Message[];
    conversation: Conversation;
  }>(`/api/messages?conversationWith=${conversationWith}`, {
    immediate: true,
  });

  // Send message mutation
  const {
    loading: sendingMessage,
    mutate: sendMessage,
    error: sendError,
  } = useApiMutation<
    any,
    {
      recipientId: string;
      content: string;
      type?: string;
    }
  >('/api/messages', {
    onSuccess: () => {
      setNewMessage('');
      fetchMessages(); // Refresh messages
    },
  });

  const messages = messagesResponse?.messages || [];
  const conversation = messagesResponse?.conversation;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    try {
      await sendMessage({
        recipientId: conversationWith,
        content: newMessage.trim(),
        type: 'text',
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loadingMessages && !messages.length) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (messagesError) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-red-600 mb-2'>Failed to load messages</p>
          <button
            onClick={() => fetchMessages()}
            className='text-indigo-600 hover:text-indigo-500 font-medium'
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-gray-200 bg-white'>
        <div className='flex items-center space-x-3'>
          {conversation?.participants
            .filter(p => p.id !== session?.user.id)
            .map(participant => (
              <div key={participant.id} className='flex items-center space-x-3'>
                <div className='w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center'>
                  {participant.avatar ? (
                    <img
                      src={participant.avatar}
                      alt={participant.displayName}
                      className='w-10 h-10 rounded-full object-cover'
                    />
                  ) : (
                    <span className='text-indigo-600 font-medium'>
                      {participant.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className='font-semibold text-gray-900'>{participant.displayName}</h2>
                  <p className='text-sm text-gray-500'>Active now</p>
                </div>
              </div>
            ))}
        </div>
        {onClose && (
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 p-2'>
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {messages.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-center text-gray-500'>
              <p>No messages yet</p>
              <p className='text-sm'>Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === session?.user.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.senderId === session?.user.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className='break-words'>{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.senderId === session?.user.id ? 'text-indigo-200' : 'text-gray-500'
                  }`}
                >
                  {formatMessageTime(message.createdAt)}
                  {message.readAt && message.senderId === session?.user.id && (
                    <span className='ml-1'>✓</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className='border-t border-gray-200 p-4 bg-white'>
        <form onSubmit={handleSendMessage} className='flex items-center space-x-3'>
          <div className='flex-1'>
            <input
              type='text'
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder='Type a message...'
              className='w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
              disabled={sendingMessage}
            />
          </div>

          <div className='flex items-center space-x-2'>
            <button
              type='button'
              className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'
              title='Attach photo'
            >
              <PhotoIcon className='w-5 h-5' />
            </button>
            <button
              type='button'
              className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'
              title='Voice message'
            >
              <MicrophoneIcon className='w-5 h-5' />
            </button>
            <button
              type='submit'
              disabled={!newMessage.trim() || sendingMessage}
              className='p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {sendingMessage ? (
                <LoadingSpinner size='sm' color='white' />
              ) : (
                <PaperAirplaneIcon className='w-5 h-5' />
              )}
            </button>
          </div>
        </form>
        {sendError && (
          <p className='text-red-600 text-sm mt-2'>Failed to send message. Please try again.</p>
        )}
      </div>
    </div>
  );
}
