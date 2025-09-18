'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RealTimeChat } from '@/components/chat/RealTimeChat';
import { Message, User } from '@/types/websocket';

export default function ChatPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const otherUserId = params?.userId as string;

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setError('Please log in to access chat');
      setLoading(false);
      return;
    }

    if (!otherUserId) {
      setError('Invalid user ID');
      setLoading(false);
      return;
    }

    // Fetch other user's info and initial messages
    const fetchChatData = async () => {
      try {
        setLoading(true);
        
        // Fetch user info (you'd implement this endpoint)
        const userResponse = await fetch(`/api/users/${otherUserId}`);
        if (!userResponse.ok) {
          throw new Error('User not found');
        }
        const userData = await userResponse.json();
        setOtherUser({
          id: userData.id,
          displayName: userData.displayName,
          avatar: userData.avatar,
          role: userData.role,
        });

        // Fetch conversation messages
        const messagesResponse = await fetch(`/api/messages?conversationWith=${otherUserId}&limit=50`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          if (messagesData.success && messagesData.data.messages) {
            setInitialMessages(messagesData.data.messages);
          }
        }

      } catch (err) {
        console.error('Failed to load chat data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };

    fetchChatData();
  }, [otherUserId, status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading chat...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-red-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load chat</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User not found</h2>
          <p className="text-gray-600">The user you're trying to chat with doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <RealTimeChat
        otherUser={otherUser}
        initialMessages={initialMessages}
        onMessageSent={(message) => {
          console.log('Message sent:', message);
        }}
        className="flex-1"
      />
    </div>
  );
}