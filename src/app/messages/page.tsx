'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';
import { ClientOnly } from '@/components/ui/ClientOnly';
import { SocketProvider, Conversation } from '@/contexts/socket-context';
import { ConversationsList } from '@/components/messaging/conversations-list';
import { ChatInterface } from '@/components/messaging/chat-interface';
import { EnhancedCard } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { MessageCircle, ArrowLeft, Users, Plus } from 'lucide-react';
import Link from 'next/link';

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  // Handle mobile responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <LoadingSpinner size='lg' />
          <p className='mt-3 text-sm text-gray-600'>Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <ClientOnly
      fallback={
        <div className='min-h-screen flex items-center justify-center'>
          <div className='flex flex-col items-center'>
            <LoadingSpinner size='lg' />
            <p className='mt-3 text-sm text-gray-600'>Loading messages...</p>
          </div>
        </div>
      }
    >
      <SocketProvider>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <EnhancedButton
                    variant="ghost"
                    size="sm"
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back to Dashboard
                  </EnhancedButton>
                </Link>
                
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <MessageCircle className="w-8 h-8" />
                    Messages
                  </h1>
                  <p className="text-gray-600 mt-1">Connect with artists and fans in real-time</p>
                </div>
              </div>

              {/* Mobile back button when in conversation view */}
              {isMobile && selectedConversation && (
                <EnhancedButton
                  variant="secondary"
                  size="sm"
                  onClick={handleBackToList}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </EnhancedButton>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-6 h-[calc(100vh-200px)]">
              {/* Conversations Sidebar */}
              <div className="md:col-span-1 lg:col-span-2">
                <ConversationsList
                  onSelectConversation={handleSelectConversation}
                  selectedConversationId={selectedConversation?.conversationId}
                />
              </div>

              {/* Chat Interface */}
              <div className="md:col-span-2 lg:col-span-3">
                <ChatInterface conversation={selectedConversation} />
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden h-[calc(100vh-180px)]">
              {!selectedConversation ? (
                <ConversationsList
                  onSelectConversation={handleSelectConversation}
                  selectedConversationId={selectedConversation?.conversationId}
                />
              ) : (
                <ChatInterface conversation={selectedConversation} />
              )}
            </div>

            {/* Demo Message for Development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6">
                <EnhancedCard className="p-4 border-dashed border-blue-300 bg-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900">Development Demo</h4>
                      <p className="text-sm text-blue-700">
                        Real-time messaging is active! Open multiple browser windows to test live messaging between users.
                      </p>
                    </div>
                    <EnhancedButton
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        // Demo: Start a new conversation
                        console.log('Demo: Starting new conversation...');
                      }}
                    >
                      Start Demo Chat
                    </EnhancedButton>
                  </div>
                </EnhancedCard>
              </div>
            )}
          </div>
        </div>
      </SocketProvider>
    </ClientOnly>
  );
}