import { 
  Conversation, 
  Message, 
  ConversationParticipant, 
  MessageSender,
  TypingIndicator 
} from '../types/messaging';

// Mock user data
export const mockUsers: MessageSender[] = [
  {
    id: 'current_user_id',
    name: 'You',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    role: 'FAN',
    verified: false,
  },
  {
    id: 'creator_1',
    name: 'Aria Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b9c94e9d?w=150',
    role: 'ARTIST',
    verified: true,
  },
  {
    id: 'creator_2',
    name: 'Marcus Williams',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    role: 'ARTIST',
    verified: true,
  },
  {
    id: 'fan_1',
    name: 'Emma Davis',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    role: 'FAN',
    verified: false,
  },
  {
    id: 'fan_2',
    name: 'Jake Thompson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    role: 'FAN',
    verified: false,
  },
  {
    id: 'fan_3',
    name: 'Sophie Miller',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    role: 'FAN',
    verified: false,
  },
];

// Mock participants
export const mockParticipants: Record<string, ConversationParticipant[]> = {
  'conv_1': [
    {
      userId: 'current_user_id',
      userName: 'You',
      userAvatar: mockUsers[0].avatar,
      role: 'FAN',
      joinedAt: '2024-01-15T10:00:00Z',
      lastSeenAt: '2024-01-20T15:30:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canDeleteMessages: false,
        canInviteUsers: false,
        isAdmin: false,
      },
    },
    {
      userId: 'creator_1',
      userName: 'Aria Chen',
      userAvatar: mockUsers[1].avatar,
      role: 'CREATOR',
      joinedAt: '2024-01-10T08:00:00Z',
      lastSeenAt: '2024-01-20T16:00:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canDeleteMessages: true,
        canInviteUsers: true,
        isAdmin: true,
      },
    },
  ],
  'conv_2': [
    {
      userId: 'current_user_id',
      userName: 'You',
      userAvatar: mockUsers[0].avatar,
      role: 'FAN',
      joinedAt: '2024-01-12T14:00:00Z',
      lastSeenAt: '2024-01-20T14:45:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: false,
        canDeleteMessages: false,
        canInviteUsers: false,
        isAdmin: false,
      },
    },
    {
      userId: 'creator_2',
      userName: 'Marcus Williams',
      userAvatar: mockUsers[2].avatar,
      role: 'CREATOR',
      joinedAt: '2024-01-01T12:00:00Z',
      lastSeenAt: '2024-01-20T15:20:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canDeleteMessages: true,
        canInviteUsers: true,
        isAdmin: true,
      },
    },
  ],
  'conv_3': [
    {
      userId: 'current_user_id',
      userName: 'You',
      userAvatar: mockUsers[0].avatar,
      role: 'FAN',
      joinedAt: '2024-01-18T09:00:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canDeleteMessages: false,
        canInviteUsers: false,
        isAdmin: false,
      },
    },
    {
      userId: 'fan_1',
      userName: 'Emma Davis',
      userAvatar: mockUsers[3].avatar,
      role: 'FAN',
      joinedAt: '2024-01-18T09:00:00Z',
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canDeleteMessages: false,
        canInviteUsers: false,
        isAdmin: false,
      },
    },
  ],
};

// Mock messages
export const mockMessages: Record<string, Message[]> = {
  'conv_1': [
    {
      id: 'msg_1',
      conversationId: 'conv_1',
      senderId: 'creator_1',
      senderInfo: mockUsers[1],
      type: 'TEXT',
      content: 'Hey! Thanks for subscribing to my channel. I really appreciate the support! 🎵',
      status: 'READ',
      timestamp: '2024-01-20T10:00:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_2',
      conversationId: 'conv_1',
      senderId: 'current_user_id',
      senderInfo: mockUsers[0],
      type: 'TEXT',
      content: 'Your music is amazing! I\'ve been following you since your first single.',
      status: 'READ',
      timestamp: '2024-01-20T10:05:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_3',
      conversationId: 'conv_1',
      senderId: 'creator_1',
      senderInfo: mockUsers[1],
      type: 'IMAGE',
      content: 'Here\'s a behind-the-scenes photo from my latest recording session!',
      mediaUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500',
      mediaThumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200',
      status: 'READ',
      timestamp: '2024-01-20T14:30:00Z',
      isEdited: false,
      isDeleted: false,
      mediaMetadata: {
        fileName: 'recording-session.jpg',
        fileSize: 245760,
        width: 800,
        height: 600,
        mimeType: 'image/jpeg',
      },
    },
    {
      id: 'msg_4',
      conversationId: 'conv_1',
      senderId: 'current_user_id',
      senderInfo: mockUsers[0],
      type: 'TEXT',
      content: 'Wow, that looks incredible! Can\'t wait for the new album 🔥',
      status: 'DELIVERED',
      timestamp: '2024-01-20T15:45:00Z',
      isEdited: false,
      isDeleted: false,
    },
  ],
  'conv_2': [
    {
      id: 'msg_5',
      conversationId: 'conv_2',
      senderId: 'current_user_id',
      senderInfo: mockUsers[0],
      type: 'TEXT',
      content: 'Hi Marcus! Love your latest track on SoundCloud',
      status: 'READ',
      timestamp: '2024-01-19T16:20:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_6',
      conversationId: 'conv_2',
      senderId: 'creator_2',
      senderInfo: mockUsers[2],
      type: 'TEXT',
      content: 'Thanks! That means a lot. Are you interested in exclusive early access to my upcoming releases?',
      status: 'READ',
      timestamp: '2024-01-19T18:10:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_7',
      conversationId: 'conv_2',
      senderId: 'creator_2',
      senderInfo: mockUsers[2],
      type: 'AUDIO',
      content: 'Here\'s a preview of my next single - just for you!',
      mediaUrl: 'https://www.soundjay.com/misc/sounds/magic-chime-02.mp3',
      status: 'READ',
      timestamp: '2024-01-20T11:15:00Z',
      isEdited: false,
      isDeleted: false,
      mediaMetadata: {
        fileName: 'preview-track.mp3',
        fileSize: 2048000,
        duration: 30,
        mimeType: 'audio/mpeg',
      },
    },
    {
      id: 'msg_8',
      conversationId: 'conv_2',
      senderId: 'current_user_id',
      senderInfo: mockUsers[0],
      type: 'TEXT',
      content: 'This is fire! 🔥 Definitely interested in early access',
      status: 'SENT',
      timestamp: '2024-01-20T16:30:00Z',
      isEdited: false,
      isDeleted: false,
    },
  ],
  'conv_3': [
    {
      id: 'msg_9',
      conversationId: 'conv_3',
      senderId: 'fan_1',
      senderInfo: mockUsers[3],
      type: 'TEXT',
      content: 'Hey! Did you see Aria\'s new music video?',
      status: 'READ',
      timestamp: '2024-01-20T12:00:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_10',
      conversationId: 'conv_3',
      senderId: 'current_user_id',
      senderInfo: mockUsers[0],
      type: 'TEXT',
      content: 'Yes! It\'s amazing. The production quality is insane',
      status: 'READ',
      timestamp: '2024-01-20T12:02:00Z',
      isEdited: false,
      isDeleted: false,
    },
    {
      id: 'msg_11',
      conversationId: 'conv_3',
      senderId: 'fan_1',
      senderInfo: mockUsers[3],
      type: 'TEXT',
      content: 'I know right! She\'s so talented 😍',
      status: 'DELIVERED',
      timestamp: '2024-01-20T16:45:00Z',
      isEdited: false,
      isDeleted: false,
    },
  ],
};

// Mock conversations
export const mockConversations: Conversation[] = [
  {
    id: 'conv_1',
    type: 'DIRECT',
    participants: mockParticipants['conv_1'],
    creatorId: 'creator_1',
    lastMessage: mockMessages['conv_1'][mockMessages['conv_1'].length - 1],
    lastMessageAt: '2024-01-20T15:45:00Z',
    lastReadAt: {
      'current_user_id': '2024-01-20T15:45:00Z',
      'creator_1': '2024-01-20T15:30:00Z',
    },
    isArchived: false,
    isMuted: false,
    isPinned: true,
    isSubscriptionRequired: true,
    subscriptionTier: 'premium',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:45:00Z',
    unreadCount: 0,
  },
  {
    id: 'conv_2',
    type: 'DIRECT',
    participants: mockParticipants['conv_2'],
    creatorId: 'creator_2',
    lastMessage: mockMessages['conv_2'][mockMessages['conv_2'].length - 1],
    lastMessageAt: '2024-01-20T16:30:00Z',
    lastReadAt: {
      'current_user_id': '2024-01-20T16:30:00Z',
      'creator_2': '2024-01-20T15:20:00Z',
    },
    isArchived: false,
    isMuted: false,
    isPinned: false,
    isSubscriptionRequired: true,
    subscriptionTier: 'basic',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-20T16:30:00Z',
    unreadCount: 0,
  },
  {
    id: 'conv_3',
    type: 'DIRECT',
    participants: mockParticipants['conv_3'],
    lastMessage: mockMessages['conv_3'][mockMessages['conv_3'].length - 1],
    lastMessageAt: '2024-01-20T16:45:00Z',
    lastReadAt: {
      'current_user_id': '2024-01-20T16:45:00Z',
      'fan_1': '2024-01-20T16:40:00Z',
    },
    isArchived: false,
    isMuted: false,
    isPinned: false,
    isSubscriptionRequired: false,
    createdAt: '2024-01-18T09:00:00Z',
    updatedAt: '2024-01-20T16:45:00Z',
    unreadCount: 1,
  },
  {
    id: 'conv_4',
    type: 'DIRECT',
    participants: [
      mockParticipants['conv_1'][0], // current user
      {
        ...mockParticipants['conv_1'][1],
        userId: 'fan_2',
        userName: 'Jake Thompson',
        userAvatar: mockUsers[4].avatar,
        role: 'FAN',
      },
    ],
    lastMessage: {
      id: 'msg_12',
      conversationId: 'conv_4',
      senderId: 'fan_2',
      senderInfo: mockUsers[4],
      type: 'TEXT',
      content: 'Hey! Are you going to the concert next week?',
      status: 'DELIVERED',
      timestamp: '2024-01-18T14:20:00Z',
      isEdited: false,
      isDeleted: false,
    },
    lastMessageAt: '2024-01-18T14:20:00Z',
    isArchived: false,
    isMuted: true,
    isPinned: false,
    isSubscriptionRequired: false,
    createdAt: '2024-01-17T11:00:00Z',
    updatedAt: '2024-01-18T14:20:00Z',
    unreadCount: 2,
  },
  {
    id: 'conv_5',
    type: 'GROUP',
    participants: [
      mockParticipants['conv_1'][0], // current user
      mockParticipants['conv_3'][1], // Emma Davis
      {
        ...mockParticipants['conv_1'][1],
        userId: 'fan_3',
        userName: 'Sophie Miller',
        userAvatar: mockUsers[5].avatar,
        role: 'FAN',
      },
    ],
    title: 'Music Lovers',
    avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150',
    description: 'Discussion group for music enthusiasts',
    lastMessage: {
      id: 'msg_13',
      conversationId: 'conv_5',
      senderId: 'fan_3',
      senderInfo: mockUsers[5],
      type: 'TEXT',
      content: 'Check out this new artist I discovered!',
      status: 'DELIVERED',
      timestamp: '2024-01-16T19:30:00Z',
      isEdited: false,
      isDeleted: false,
    },
    lastMessageAt: '2024-01-16T19:30:00Z',
    isArchived: false,
    isMuted: false,
    isPinned: false,
    isSubscriptionRequired: false,
    createdAt: '2024-01-14T16:00:00Z',
    updatedAt: '2024-01-16T19:30:00Z',
    unreadCount: 0,
  },
];

// Mock typing indicators
export const mockTypingIndicators: Record<string, TypingIndicator[]> = {
  'conv_1': [],
  'conv_2': [
    {
      conversationId: 'conv_2',
      userId: 'creator_2',
      userName: 'Marcus Williams',
      isTyping: true,
      timestamp: new Date().toISOString(),
    },
  ],
  'conv_3': [],
};

// Mock online users
export const mockOnlineUsers: Set<string> = new Set([
  'creator_1',
  'creator_2',
  'fan_1',
]);

// Helper function to get a user by ID
export const getUserById = (id: string): MessageSender | undefined => {
  return mockUsers.find(user => user.id === id);
};

// Helper function to get random message for testing
export const generateRandomMessage = (conversationId: string, senderId: string): Message => {
  const sender = getUserById(senderId);
  if (!sender) throw new Error('Sender not found');

  const messageTypes: Array<'TEXT' | 'IMAGE' | 'AUDIO'> = ['TEXT', 'TEXT', 'TEXT', 'IMAGE', 'AUDIO'];
  const type = messageTypes[Math.floor(Math.random() * messageTypes.length)];
  
  const textMessages = [
    'Hey there!',
    'How are you doing?',
    'That sounds great!',
    'I love your music 🎵',
    'Thanks for the support!',
    'Can\'t wait for the new release',
    'Amazing work!',
    'Keep it up! 🔥',
    'This is incredible',
    'Sounds good to me',
  ];

  let content = textMessages[Math.floor(Math.random() * textMessages.length)];
  let mediaUrl: string | undefined;
  let mediaMetadata;

  if (type === 'IMAGE') {
    content = 'Check this out!';
    mediaUrl = `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000000)}?w=500`;
    mediaMetadata = {
      fileName: 'image.jpg',
      fileSize: Math.floor(Math.random() * 1000000),
      width: 800,
      height: 600,
      mimeType: 'image/jpeg',
    };
  } else if (type === 'AUDIO') {
    content = 'Listen to this!';
    mediaUrl = 'https://www.soundjay.com/misc/sounds/magic-chime-02.mp3';
    mediaMetadata = {
      fileName: 'audio.mp3',
      fileSize: Math.floor(Math.random() * 5000000),
      duration: Math.floor(Math.random() * 180) + 30,
      mimeType: 'audio/mpeg',
    };
  }

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    conversationId,
    senderId,
    senderInfo: sender,
    type,
    content,
    mediaUrl,
    mediaThumbnail: type === 'IMAGE' ? mediaUrl?.replace('w=500', 'w=200') : undefined,
    mediaMetadata,
    status: senderId === 'current_user_id' ? 'SENT' : 'DELIVERED',
    timestamp: new Date().toISOString(),
    isEdited: false,
    isDeleted: false,
  };
};