'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical,
  Search,
  Phone,
  Video,
  User,
  Circle,
  MessageCircle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file';
}

interface ChatRoom {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  type: 'direct' | 'group';
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    loadChatData();
  }, [session, status, router]);

  const loadChatData = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call to load chat rooms
      const mockRooms: ChatRoom[] = [
        {
          id: 'room-1',
          name: 'Alex Morgan',
          avatar: '/mock-avatar-1.jpg',
          isOnline: true,
          lastMessage: 'Thanks for subscribing! 💖',
          lastMessageTime: '2 min ago',
          unreadCount: 2,
          type: 'direct'
        },
        {
          id: 'room-2',
          name: 'Sarah Wilson',
          avatar: '/mock-avatar-2.jpg',
          isOnline: false,
          lastMessage: 'Looking forward to your next stream!',
          lastMessageTime: '1 hour ago',
          unreadCount: 0,
          type: 'direct'
        },
        {
          id: 'room-3',
          name: 'VIP Members',
          avatar: '/mock-group.jpg',
          isOnline: true,
          lastMessage: 'Welcome to the VIP chat!',
          lastMessageTime: '3 hours ago',
          unreadCount: 5,
          type: 'group'
        }
      ];

      // Mock messages for the first room
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alex Morgan',
          content: 'Hey! Thanks for subscribing to my content 🎵',
          timestamp: '2024-09-21T14:30:00Z',
          type: 'text'
        },
        {
          id: 'msg-2',
          senderId: 'current-user',
          senderName: 'You',
          content: 'Love your music! Can\'t wait for the next release',
          timestamp: '2024-09-21T14:31:00Z',
          type: 'text'
        },
        {
          id: 'msg-3',
          senderId: 'user-1',
          senderName: 'Alex Morgan',
          content: 'Thanks for subscribing! 💖',
          timestamp: '2024-09-21T14:32:00Z',
          type: 'text'
        }
      ];

      setChatRooms(mockRooms);
      setMessages(mockMessages);
      setActiveRoom(mockRooms[0].id);
    } catch (error) {
      console.error('Failed to load chat data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeRoom) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'current-user',
      senderName: 'You',
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // In real app, would send message via WebSocket or API
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const activeRoomData = chatRooms.find(room => room.id === activeRoom);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chatRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setActiveRoom(room.id)}
              className={`p-4 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${
                activeRoom === room.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  {room.isOnline && (
                    <Circle className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full fill-current" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {room.name}
                    </h3>
                    <span className="text-xs text-gray-500">{room.lastMessageTime}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">
                    {room.lastMessage}
                  </p>
                  {room.unreadCount > 0 && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeRoomData ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    {activeRoomData.isOnline && (
                      <Circle className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-white rounded-full fill-current" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {activeRoomData.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {activeRoomData.isOnline ? 'Online' : 'Last seen recently'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.senderId === 'current-user';
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwnMessage
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="rounded-full"
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-600">
                Choose from your existing conversations or start a new one.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}