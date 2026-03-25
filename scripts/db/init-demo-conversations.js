#!/usr/bin/env node

/**
 * Initialize demo conversations for DirectFanZ messaging
 * This creates some sample conversations for immediate testing
 */

// Demo users and conversations
const demoUsers = [
  { id: 'user_artist_1', username: 'ArtistAlex', role: 'ARTIST' },
  { id: 'user_artist_2', username: 'MusicMia', role: 'ARTIST' },
  { id: 'user_fan_1', username: 'FanSarah', role: 'FAN' },
  { id: 'user_fan_2', username: 'FanMike', role: 'FAN' },
];

const demoConversations = [
  {
    id: 'conv_user_artist_1_user_fan_1',
    participants: ['user_artist_1', 'user_fan_1'],
    messages: [
      {
        id: 'msg_1',
        senderId: 'user_fan_1',
        senderUsername: 'FanSarah',
        senderRole: 'FAN',
        receiverId: 'user_artist_1',
        content: 'Hi! I love your latest song! 🎵',
        type: 'text',
        timestamp: new Date(Date.now() - 3600000),
        read: true
      },
      {
        id: 'msg_2',
        senderId: 'user_artist_1',
        senderUsername: 'ArtistAlex',
        senderRole: 'ARTIST',
        receiverId: 'user_fan_1',
        content: 'Thank you so much! That means a lot to me 💕',
        type: 'text',
        timestamp: new Date(Date.now() - 3000000),
        read: true
      },
      {
        id: 'msg_3',
        senderId: 'user_fan_1',
        senderUsername: 'FanSarah',
        senderRole: 'FAN',
        receiverId: 'user_artist_1',
        content: 'Any chance you\'ll do a live stream soon?',
        type: 'text',
        timestamp: new Date(Date.now() - 1800000),
        read: false
      }
    ]
  },
  {
    id: 'conv_user_artist_2_user_fan_2',
    participants: ['user_artist_2', 'user_fan_2'],
    messages: [
      {
        id: 'msg_4',
        senderId: 'user_fan_2',
        senderUsername: 'FanMike',
        senderRole: 'FAN',
        receiverId: 'user_artist_2',
        content: 'Your voice is incredible! 🎤',
        type: 'text',
        timestamp: new Date(Date.now() - 7200000),
        read: true
      },
      {
        id: 'msg_5',
        senderId: 'user_artist_2',
        senderUsername: 'MusicMia',
        senderRole: 'ARTIST',
        receiverId: 'user_fan_2',
        content: 'Aww thank you! Working on some new material 🎼',
        type: 'text',
        timestamp: new Date(Date.now() - 3600000),
        read: true
      }
    ]
  }
];

// Export for use by WebSocket server
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { demoUsers, demoConversations };
}

console.log('Demo conversations data ready!');
console.log(`👥 Demo Users: ${demoUsers.length}`);
console.log(`💬 Demo Conversations: ${demoConversations.length}`);

demoUsers.forEach(user => {
  console.log(`  - ${user.username} (${user.role})`);
});

console.log('\nDemo conversations:');
demoConversations.forEach(conv => {
  const user1 = demoUsers.find(u => u.id === conv.participants[0]);
  const user2 = demoUsers.find(u => u.id === conv.participants[1]);
  console.log(`  - ${user1?.username} ↔ ${user2?.username} (${conv.messages.length} messages)`);
});