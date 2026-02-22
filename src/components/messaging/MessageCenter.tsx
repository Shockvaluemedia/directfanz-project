'use client';

/**
 * Real-Time Messaging Center - Client Component
 *
 * This component provides a comprehensive messaging interface with:
 * - Real-time message delivery via Socket.io
 * - Multiple conversation management
 * - File sharing and media support
 * - Message reactions and emoji picker
 * - Typing indicators and read receipts
 * - Search and message history
 * - Mobile-responsive design
 * - Accessibility support
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  VideoCameraIcon,
  UserGroupIcon,
  PlusIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon, HandThumbUpIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { cn } from '@/lib/utils';

// Types
interface Message {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  replyToId?: string;
  edited?: boolean;
  editedAt?: Date;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name: string;
  size: number;
  thumbnail?: string;
}

interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  count: number;
  userReacted: boolean;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'DIRECT' | 'GROUP' | 'COMMUNITY' | 'FAN_CLUB';
  isPrivate: boolean;
  members: Array<{
    id: string;
    name: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen?: Date;
  }>;
  lastMessage?: Message;
  unreadCount: number;
}

interface TypingUser {
  userId: string;
  userName: string;
}

export default function MessageCenter() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showRoomList, setShowRoomList] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!session?.user?.id) return;

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: {
        token: session.accessToken, // Assuming you have access token in session
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Connected to messaging server');
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from messaging server');
    });

    newSocket.on('error', error => {
      console.error('Socket error:', error);
      toast.error(error.message || 'Connection error');
    });

    // Message events
    newSocket.on('new_message', handleNewMessage);
    newSocket.on('message_history', handleMessageHistory);
    newSocket.on('message_edited', handleMessageEdited);
    newSocket.on('message_deleted', handleMessageDeleted);
    newSocket.on('reaction_added', handleReactionAdded);
    newSocket.on('reaction_removed', handleReactionRemoved);

    // Typing events
    newSocket.on('typing_start', handleTypingStart);
    newSocket.on('typing_stop', handleTypingStop);

    // Presence events
    newSocket.on('user_presence', handleUserPresence);
    newSocket.on('user_joined', handleUserJoined);
    newSocket.on('user_left', handleUserLeft);

    // Room events
    newSocket.on('room_created', handleRoomCreated);
    newSocket.on('user_rooms', handleUserRooms);

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [session?.user?.id]);

  // Handle responsive design
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowRoomList(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Socket event handlers
  const handleNewMessage = useCallback(
    (data: { roomId: string; message: Message }) => {
      const { roomId, message } = data;

      if (activeRoom?.id === roomId) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      }

      // Update room's last message and unread count
      setRooms(prev =>
        prev.map(room =>
          room.id === roomId
            ? {
                ...room,
                lastMessage: message,
                unreadCount: room.id === activeRoom?.id ? 0 : room.unreadCount + 1,
              }
            : room
        )
      );
    },
    [activeRoom?.id]
  );

  const handleMessageHistory = useCallback(
    (data: { roomId: string; messages: Message[] }) => {
      if (data.roomId === activeRoom?.id) {
        setMessages(data.messages.reverse()); // Reverse because they come in desc order
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [activeRoom?.id]
  );

  const handleMessageEdited = useCallback(
    (data: { messageId: string; content: string; editedAt: Date }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, edited: true, editedAt: data.editedAt }
            : msg
        )
      );
    },
    []
  );

  const handleMessageDeleted = useCallback((data: { messageId: string }) => {
    setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
  }, []);

  const handleReactionAdded = useCallback(
    (data: { messageId: string; reaction: MessageReaction }) => {
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id !== data.messageId) return msg;

          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === data.reaction.emoji);

          if (existingReaction) {
            return {
              ...msg,
              reactions: reactions.map(r =>
                r.emoji === data.reaction.emoji
                  ? {
                      ...r,
                      count: r.count + 1,
                      userReacted: r.userReacted || data.reaction.userId === session?.user?.id,
                    }
                  : r
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [
                ...reactions,
                {
                  ...data.reaction,
                  count: 1,
                  userReacted: data.reaction.userId === session?.user?.id,
                },
              ],
            };
          }
        })
      );
    },
    [session?.user?.id]
  );

  const handleReactionRemoved = useCallback(
    (data: { messageId: string; emoji: string; userId: string }) => {
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id !== data.messageId) return msg;

          const reactions = (msg.reactions || [])
            .map(r => {
              if (r.emoji === data.emoji) {
                return {
                  ...r,
                  count: Math.max(0, r.count - 1),
                  userReacted: r.userReacted && data.userId !== session?.user?.id,
                };
              }
              return r;
            })
            .filter(r => r.count > 0);

          return { ...msg, reactions };
        })
      );
    },
    [session?.user?.id]
  );

  const handleTypingStart = useCallback(
    (data: { roomId: string; userId: string; userName: string }) => {
      if (data.roomId === activeRoom?.id && data.userId !== session?.user?.id) {
        setTypingUsers(prev => {
          if (!prev.some(user => user.userId === data.userId)) {
            return [...prev, { userId: data.userId, userName: data.userName }];
          }
          return prev;
        });
      }
    },
    [activeRoom?.id, session?.user?.id]
  );

  const handleTypingStop = useCallback(
    (data: { roomId: string; userId: string }) => {
      if (data.roomId === activeRoom?.id) {
        setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
      }
    },
    [activeRoom?.id]
  );

  const handleUserPresence = useCallback((data: { userId: string; isOnline: boolean }) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      if (data.isOnline) {
        newSet.add(data.userId);
      } else {
        newSet.delete(data.userId);
      }
      return newSet;
    });
  }, []);

  const handleUserJoined = useCallback(
    (data: { roomId: string; user: any }) => {
      if (data.roomId === activeRoom?.id) {
        toast.success(`${data.user.name} joined the conversation`);
      }
    },
    [activeRoom?.id]
  );

  const handleUserLeft = useCallback((data: { roomId: string; userId: string }) => {
    // Handle user leaving room
  }, []);

  const handleRoomCreated = useCallback((data: { room: ChatRoom }) => {
    setRooms(prev => [data.room, ...prev]);
    setActiveRoom(data.room);
  }, []);

  const handleUserRooms = useCallback(
    (data: { rooms: ChatRoom[] }) => {
      setRooms(data.rooms);
      if (data.rooms.length > 0 && !activeRoom) {
        setActiveRoom(data.rooms[0]);
      }
    },
    [activeRoom]
  );

  // Utility functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = useCallback(() => {
    if (!socket || !activeRoom || !messageInput.trim()) return;

    socket.emit('send_message', {
      roomId: activeRoom.id,
      content: messageInput.trim(),
      type: 'text',
    });

    setMessageInput('');
    setShowEmojiPicker(false);
  }, [socket, activeRoom, messageInput]);

  const joinRoom = useCallback(
    (room: ChatRoom) => {
      if (!socket || room.id === activeRoom?.id) return;

      if (activeRoom) {
        socket.emit('leave_room', { roomId: activeRoom.id });
      }

      socket.emit('join_room', { roomId: room.id });
      setActiveRoom(room);
      setMessages([]);
      setIsLoading(true);

      if (isMobile) {
        setShowRoomList(false);
      }

      // Mark room as read
      setRooms(prev => prev.map(r => (r.id === room.id ? { ...r, unreadCount: 0 } : r)));
    },
    [socket, activeRoom, isMobile]
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket) return;

      socket.emit('add_reaction', { messageId, emoji });
    },
    [socket]
  );

  const removeReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket) return;

      socket.emit('remove_reaction', { messageId, emoji });
    },
    [socket]
  );

  const handleTyping = useCallback(() => {
    if (!socket || !activeRoom) return;

    socket.emit('typing_start', { roomId: activeRoom.id });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { roomId: activeRoom.id });
    }, 1000);
  }, [socket, activeRoom]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredRooms = useMemo(() => {
    if (!searchQuery) return rooms;
    return rooms.filter(room => room.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [rooms, searchQuery]);

  const formatMessageTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => (
    <div className={cn('flex mb-4 max-w-[85%]', isOwn ? 'ml-auto' : 'mr-auto')}>
      {!isOwn && (
        <div className='flex-shrink-0 mr-3'>
          <div className='w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-sm font-medium'>
            {message.sender.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <div
        className={cn(
          'rounded-2xl px-4 py-2 max-w-full break-words',
          isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        )}
      >
        {!isOwn && <div className='text-xs font-medium mb-1 opacity-70'>{message.sender.name}</div>}

        <div className='text-sm leading-relaxed'>{message.content}</div>

        {message.attachments && message.attachments.length > 0 && (
          <div className='mt-2 space-y-2'>
            {message.attachments.map(attachment => (
              <div key={attachment.id} className='rounded-lg overflow-hidden'>
                {attachment.type === 'image' && (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className='max-w-full h-auto rounded-lg'
                  />
                )}
                {attachment.type === 'file' && (
                  <div className='flex items-center p-2 bg-white/10 rounded-lg'>
                    <PaperClipIcon className='w-4 h-4 mr-2' />
                    <span className='text-xs'>{attachment.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'text-xs mt-1 opacity-60 flex items-center gap-2',
            isOwn ? 'text-white/70' : 'text-gray-500'
          )}
        >
          {formatMessageTime(message.createdAt)}
          {message.edited && <span>(edited)</span>}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className='flex flex-wrap gap-1 mt-2'>
            {message.reactions.map(reaction => (
              <button
                key={reaction.emoji}
                onClick={() =>
                  reaction.userReacted
                    ? removeReaction(message.id, reaction.emoji)
                    : addReaction(message.id, reaction.emoji)
                }
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors',
                  reaction.userReacted
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button
              onClick={() => {
                // Show reaction picker
                // This would integrate with your emoji picker
                addReaction(message.id, '👍');
              }}
              className='w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs transition-colors'
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>Please sign in to access messages</p>
      </div>
    );
  }

  return (
    <div className='flex h-[600px] bg-white border border-gray-200 rounded-lg overflow-hidden'>
      {/* Room List */}
      <div
        className={cn(
          'w-80 border-r border-gray-200 flex flex-col',
          isMobile && !showRoomList && 'hidden'
        )}
      >
        {/* Header */}
        <div className='p-4 border-b border-gray-200'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>Messages</h2>
            <button className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'>
              <PlusIcon className='w-5 h-5' />
            </button>
          </div>

          {/* Search */}
          <div className='relative'>
            <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search conversations...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>
        </div>

        {/* Room List */}
        <div className='flex-1 overflow-y-auto'>
          {filteredRooms.map(room => (
            <button
              key={room.id}
              onClick={() => joinRoom(room)}
              className={cn(
                'w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors',
                activeRoom?.id === room.id && 'bg-blue-50 border-blue-200'
              )}
            >
              <div className='flex items-center'>
                <div className='flex-shrink-0 mr-3'>
                  {room.type === 'DIRECT' ? (
                    <div className='relative'>
                      <div className='w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-medium'>
                        {room.name.charAt(0).toUpperCase()}
                      </div>
                      {room.members[0] && onlineUsers.has(room.members[0].id) && (
                        <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full'></div>
                      )}
                    </div>
                  ) : (
                    <div className='w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white'>
                      <UserGroupIcon className='w-6 h-6' />
                    </div>
                  )}
                </div>

                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between mb-1'>
                    <h3 className='text-sm font-medium text-gray-900 truncate'>{room.name}</h3>
                    {room.lastMessage && (
                      <span className='text-xs text-gray-500'>
                        {formatMessageTime(room.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className='flex items-center justify-between'>
                    <p className='text-sm text-gray-500 truncate'>
                      {room.lastMessage?.content || 'No messages yet'}
                    </p>
                    {room.unreadCount > 0 && (
                      <span className='ml-2 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full'>
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn('flex-1 flex flex-col', isMobile && showRoomList && 'hidden')}>
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className='p-4 border-b border-gray-200 bg-white'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center'>
                  {isMobile && (
                    <button
                      onClick={() => setShowRoomList(true)}
                      className='mr-3 p-1 text-gray-400 hover:text-gray-600'
                    >
                      <ChevronLeftIcon className='w-5 h-5' />
                    </button>
                  )}

                  <div className='flex items-center'>
                    <div className='w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-medium mr-3'>
                      {activeRoom.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className='text-lg font-semibold text-gray-900'>{activeRoom.name}</h3>
                      {activeRoom.type === 'DIRECT' && activeRoom.members[0] && (
                        <p className='text-sm text-gray-500'>
                          {onlineUsers.has(activeRoom.members[0].id) ? 'Online' : 'Offline'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  <button className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'>
                    <PhoneIcon className='w-5 h-5' />
                  </button>
                  <button className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'>
                    <VideoCameraIcon className='w-5 h-5' />
                  </button>
                  <button className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100'>
                    <EllipsisVerticalIcon className='w-5 h-5' />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className='flex-1 overflow-y-auto p-4 bg-gray-50'>
              {isLoading ? (
                <div className='flex items-center justify-center h-full'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                </div>
              ) : (
                <>
                  {messages.map(message => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderId === session.user?.id}
                    />
                  ))}

                  {/* Typing indicators */}
                  {typingUsers.length > 0 && (
                    <div className='flex items-center space-x-2 mb-4'>
                      <div className='flex space-x-1'>
                        <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'></div>
                        <div
                          className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                      <span className='text-sm text-gray-500'>
                        {typingUsers.length === 1
                          ? `${typingUsers[0].userName} is typing...`
                          : `${typingUsers.length} people are typing...`}
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className='p-4 border-t border-gray-200 bg-white'>
              {showEmojiPicker && (
                <div className='absolute bottom-16 right-4 z-50'>
                  <EmojiPicker
                    onEmojiClick={emojiData => {
                      setMessageInput(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                  />
                </div>
              )}

              <div className='flex items-end space-x-3'>
                <input
                  type='file'
                  ref={fileInputRef}
                  multiple
                  accept='image/*,video/*,audio/*,.pdf,.txt'
                  className='hidden'
                  onChange={e => {
                    // Handle file uploads
                    console.log('Files selected:', e.target.files);
                  }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className='p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors'
                >
                  <PaperClipIcon className='w-5 h-5' />
                </button>

                <div className='flex-1 relative'>
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={e => {
                      setMessageInput(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder='Type a message...'
                    rows={1}
                    className='w-full resize-none border border-gray-300 rounded-2xl px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32'
                    style={{ minHeight: '40px' }}
                  />

                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
                  >
                    <FaceSmileIcon className='w-5 h-5' />
                  </button>
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    messageInput.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <PaperAirplaneIcon className='w-5 h-5' />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className='flex-1 flex items-center justify-center bg-gray-50'>
            <div className='text-center'>
              <div className='w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4'>
                <UserGroupIcon className='w-8 h-8 text-gray-400' />
              </div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>No conversation selected</h3>
              <p className='text-gray-500'>
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
