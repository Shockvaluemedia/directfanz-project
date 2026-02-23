import { CreatorInfo, ContentItem, TrendingData, FeedItem, ContentType, ContentVisibility } from '../types/discovery';

// Mock creators data
export const mockCreators: CreatorInfo[] = [
  {
    id: 'creator-1',
    name: 'Maya Johnson',
    artistName: 'Maya Sounds',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612d5e0?w=150&h=150&fit=crop&crop=face',
    verified: true,
    bio: '🎵 R&B artist creating soulful music that touches the heart. Join me on this musical journey! 🌟',
    genres: ['R&B', 'Soul', 'Neo-Soul'],
    location: 'Los Angeles, CA',
    socialLinks: {
      instagram: '@mayasounds',
      twitter: '@mayasounds',
      spotify: 'artist/maya-sounds',
      youtube: 'channel/mayasounds',
    },
    followerCount: 15420,
    followingCount: 234,
    contentCount: 67,
    totalViews: 234567,
    averageRating: 4.8,
    hasSubscriptionTiers: true,
    lowestTierPrice: 9.99,
    createdAt: '2023-01-15T00:00:00Z',
    lastActiveAt: '2024-01-20T15:30:00Z',
    isFollowing: false,
  },
  {
    id: 'creator-2',
    name: 'Marcus Williams',
    artistName: 'M.Williams',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    verified: false,
    bio: 'Hip-hop producer and artist. Making beats that move the soul. 🎤🔥',
    genres: ['Hip-Hop', 'Trap', 'R&B'],
    location: 'Atlanta, GA',
    socialLinks: {
      instagram: '@mwilliams_music',
      soundcloud: 'mwilliams-beats',
    },
    followerCount: 8934,
    followingCount: 189,
    contentCount: 45,
    totalViews: 123456,
    averageRating: 4.6,
    hasSubscriptionTiers: true,
    lowestTierPrice: 4.99,
    createdAt: '2023-03-20T00:00:00Z',
    lastActiveAt: '2024-01-19T10:15:00Z',
    isFollowing: true,
  },
  {
    id: 'creator-3',
    name: 'Luna Rodriguez',
    artistName: 'Luna',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    verified: true,
    bio: 'Alternative pop artist with a touch of electronic magic ✨ Creating dreamy soundscapes',
    genres: ['Pop', 'Electronic', 'Alternative'],
    location: 'New York, NY',
    socialLinks: {
      instagram: '@lunamusic',
      twitter: '@lunaofficial',
      tiktok: '@lunamusic',
      spotify: 'artist/luna-rodriguez',
    },
    followerCount: 32105,
    followingCount: 456,
    contentCount: 89,
    totalViews: 567890,
    averageRating: 4.9,
    hasSubscriptionTiers: true,
    lowestTierPrice: 12.99,
    createdAt: '2022-11-10T00:00:00Z',
    lastActiveAt: '2024-01-21T09:45:00Z',
    isFollowing: false,
  },
  {
    id: 'creator-4',
    name: 'James Thompson',
    artistName: 'Jazz Thompson',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    verified: false,
    bio: 'Jazz pianist and composer. Bringing classic jazz to modern ears 🎹',
    genres: ['Jazz', 'Classical', 'Blues'],
    location: 'Chicago, IL',
    socialLinks: {
      youtube: 'channel/jazzthompson',
      spotify: 'artist/james-thompson',
    },
    followerCount: 5678,
    followingCount: 123,
    contentCount: 34,
    totalViews: 87654,
    averageRating: 4.7,
    hasSubscriptionTiers: false,
    createdAt: '2023-06-05T00:00:00Z',
    lastActiveAt: '2024-01-18T14:20:00Z',
    isFollowing: false,
  },
  {
    id: 'creator-5',
    name: 'Aria Chen',
    artistName: 'Aria',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    verified: true,
    bio: 'Indie rock songwriter with a passion for storytelling through music 🎸📖',
    genres: ['Indie', 'Rock', 'Alternative'],
    location: 'Seattle, WA',
    socialLinks: {
      instagram: '@ariachen_music',
      soundcloud: 'aria-chen',
      website: 'ariachen.com',
    },
    followerCount: 12890,
    followingCount: 267,
    contentCount: 56,
    totalViews: 156789,
    averageRating: 4.8,
    hasSubscriptionTiers: true,
    lowestTierPrice: 7.99,
    createdAt: '2023-02-28T00:00:00Z',
    lastActiveAt: '2024-01-21T11:30:00Z',
    isFollowing: true,
  },
];

// Mock content data
export const mockContent: ContentItem[] = [
  {
    id: 'content-1',
    title: 'Midnight Dreams',
    description: 'A soulful R&B track about late night thoughts and dreams for the future',
    type: 'AUDIO',
    visibility: 'PUBLIC',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
    mediaUrl: 'https://example.com/audio/midnight-dreams.mp3',
    creatorId: 'creator-1',
    creator: mockCreators[0],
    duration: 245, // 4:05
    tags: ['soulful', 'dreamy', 'night', 'future'],
    genres: ['R&B', 'Soul'],
    viewCount: 12456,
    likeCount: 1234,
    commentCount: 89,
    shareCount: 156,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    publishedAt: '2024-01-15T00:00:00Z',
    isPublished: true,
    isLiked: false,
  },
  {
    id: 'content-2',
    title: 'City Lights',
    description: 'Hip-hop beat inspired by the urban landscape',
    type: 'AUDIO',
    visibility: 'SUBSCRIBERS_ONLY',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop',
    mediaUrl: 'https://example.com/audio/city-lights.mp3',
    previewUrl: 'https://example.com/audio/city-lights-preview.mp3',
    creatorId: 'creator-2',
    creator: mockCreators[1],
    duration: 189, // 3:09
    tags: ['urban', 'beat', 'city', 'night'],
    genres: ['Hip-Hop', 'Trap'],
    viewCount: 8934,
    likeCount: 923,
    commentCount: 67,
    shareCount: 89,
    price: 2.99,
    currency: 'USD',
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
    publishedAt: '2024-01-12T00:00:00Z',
    isPublished: true,
    isLiked: true,
  },
  {
    id: 'content-3',
    title: 'Ethereal Waves',
    description: 'An electronic pop journey through space and time',
    type: 'AUDIO',
    visibility: 'PUBLIC',
    thumbnailUrl: 'https://images.unsplash.com/photo-1571974599782-87624638275f?w=300&h=300&fit=crop',
    mediaUrl: 'https://example.com/audio/ethereal-waves.mp3',
    creatorId: 'creator-3',
    creator: mockCreators[2],
    duration: 278, // 4:38
    tags: ['electronic', 'dreamy', 'space', 'ambient'],
    genres: ['Electronic', 'Pop'],
    viewCount: 15678,
    likeCount: 1567,
    commentCount: 134,
    shareCount: 234,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    publishedAt: '2024-01-10T00:00:00Z',
    isPublished: true,
    isLiked: false,
  },
  {
    id: 'content-4',
    title: 'Morning Jazz Session',
    description: 'Live piano recording from my morning practice',
    type: 'VIDEO',
    visibility: 'PUBLIC',
    thumbnailUrl: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=300&h=300&fit=crop',
    mediaUrl: 'https://example.com/video/morning-jazz.mp4',
    creatorId: 'creator-4',
    creator: mockCreators[3],
    duration: 456, // 7:36
    tags: ['jazz', 'piano', 'morning', 'live'],
    genres: ['Jazz', 'Classical'],
    viewCount: 3456,
    likeCount: 345,
    commentCount: 23,
    shareCount: 45,
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z',
    publishedAt: '2024-01-08T00:00:00Z',
    isPublished: true,
    isLiked: false,
  },
  {
    id: 'content-5',
    title: 'Songwriting Process',
    description: 'Behind the scenes: How I write my indie rock songs',
    type: 'VIDEO',
    visibility: 'SUBSCRIBERS_ONLY',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
    mediaUrl: 'https://example.com/video/songwriting-process.mp4',
    previewUrl: 'https://example.com/video/songwriting-preview.mp4',
    creatorId: 'creator-5',
    creator: mockCreators[4],
    duration: 623, // 10:23
    tags: ['songwriting', 'process', 'indie', 'tutorial'],
    genres: ['Indie', 'Rock'],
    viewCount: 5678,
    likeCount: 567,
    commentCount: 78,
    shareCount: 89,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    publishedAt: '2024-01-05T00:00:00Z',
    isPublished: true,
    isLiked: true,
  },
  {
    id: 'content-6',
    title: 'Studio Vibes',
    description: 'Quick snippet from today\'s recording session 🎤',
    type: 'IMAGE',
    visibility: 'PUBLIC',
    thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=300&h=300&fit=crop',
    mediaUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&h=600&fit=crop',
    creatorId: 'creator-1',
    creator: mockCreators[0],
    tags: ['studio', 'recording', 'vibes', 'music'],
    genres: ['R&B'],
    viewCount: 2345,
    likeCount: 234,
    commentCount: 12,
    shareCount: 23,
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    publishedAt: '2024-01-20T00:00:00Z',
    isPublished: true,
    isLiked: true,
  },
];

// Mock trending data
export const mockTrendingData: TrendingData = {
  trendingCreators: [mockCreators[2], mockCreators[0], mockCreators[4]],
  trendingContent: [mockContent[2], mockContent[0], mockContent[4]],
  trendingGenres: ['R&B', 'Hip-Hop', 'Electronic', 'Pop', 'Indie'],
  newCreators: [mockCreators[3]],
};

// Mock feed data
export const mockFeedItems: FeedItem[] = [
  {
    id: 'feed-1',
    type: 'content',
    content: mockContent[0],
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'feed-2',
    type: 'creator_joined',
    creator: mockCreators[3],
    title: 'New Creator Joined',
    description: 'Jazz Thompson just joined the platform!',
    createdAt: '2024-01-14T00:00:00Z',
  },
  {
    id: 'feed-3',
    type: 'content',
    content: mockContent[1],
    createdAt: '2024-01-12T00:00:00Z',
  },
  {
    id: 'feed-4',
    type: 'trending',
    content: mockContent[2],
    title: 'Trending Now',
    description: 'This track is gaining popularity!',
    createdAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'feed-5',
    type: 'content',
    content: mockContent[5],
    createdAt: '2024-01-20T00:00:00Z',
  },
];

// Helper functions to generate more mock data
export const generateMockCreator = (index: number): CreatorInfo => {
  const names = [
    'Alex Rivera', 'Sam Chen', 'Jordan Blake', 'Casey Morgan', 
    'Taylor Swift', 'Riley Parker', 'Dakota Jones', 'Phoenix Wright'
  ];
  const genres = [
    ['Pop', 'Dance'], ['Rock', 'Alternative'], ['Electronic', 'House'],
    ['Country', 'Folk'], ['Jazz', 'Blues'], ['Classical', 'Orchestra'],
    ['Reggae', 'World'], ['Funk', 'Disco']
  ];
  const locations = [
    'Nashville, TN', 'Austin, TX', 'Portland, OR', 'Miami, FL',
    'Boston, MA', 'Denver, CO', 'San Francisco, CA', 'Philadelphia, PA'
  ];

  const name = names[index % names.length];
  const artistName = `${name.split(' ')[0]} Music`;
  
  return {
    id: `generated-creator-${index}`,
    name,
    artistName,
    avatar: `https://images.unsplash.com/photo-${1500000000000 + index}?w=150&h=150&fit=crop&crop=face`,
    verified: Math.random() > 0.7,
    bio: `Creating amazing ${genres[index % genres.length][0].toLowerCase()} music for the world! 🎵`,
    genres: genres[index % genres.length],
    location: locations[index % locations.length],
    followerCount: Math.floor(Math.random() * 50000) + 1000,
    followingCount: Math.floor(Math.random() * 1000) + 50,
    contentCount: Math.floor(Math.random() * 100) + 10,
    totalViews: Math.floor(Math.random() * 1000000) + 10000,
    averageRating: 4.0 + Math.random() * 1.0,
    hasSubscriptionTiers: Math.random() > 0.3,
    lowestTierPrice: Math.random() > 0.5 ? Math.floor(Math.random() * 20) + 5 : undefined,
    createdAt: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString(),
    lastActiveAt: new Date(2024, 0, Math.floor(Math.random() * 21) + 1).toISOString(),
    isFollowing: Math.random() > 0.8,
  };
};

export const generateMockContent = (index: number, creators: CreatorInfo[]): ContentItem => {
  const titles = [
    'Sunset Melody', 'Urban Nights', 'Electric Dreams', 'Acoustic Vibes',
    'Midnight Sessions', 'Golden Hour', 'Neon Lights', 'Ocean Waves',
    'Mountain High', 'City Rain', 'Desert Storm', 'Forest Sounds'
  ];
  const contentTypes: ContentType[] = ['AUDIO', 'VIDEO', 'IMAGE'];
  const visibilities: ContentVisibility[] = ['PUBLIC', 'SUBSCRIBERS_ONLY', 'PREMIUM'];

  const creator = creators[index % creators.length];
  const type = contentTypes[index % contentTypes.length];
  const title = titles[index % titles.length];

  return {
    id: `generated-content-${index}`,
    title,
    description: `${type === 'AUDIO' ? 'A beautiful track' : type === 'VIDEO' ? 'An amazing video' : 'A stunning image'} by ${creator.name}`,
    type,
    visibility: visibilities[index % visibilities.length],
    thumbnailUrl: `https://images.unsplash.com/photo-${1600000000000 + index}?w=300&h=300&fit=crop`,
    mediaUrl: `https://example.com/${type.toLowerCase()}/${title.toLowerCase().replace(' ', '-')}.${type === 'AUDIO' ? 'mp3' : type === 'VIDEO' ? 'mp4' : 'jpg'}`,
    creatorId: creator.id,
    creator,
    duration: type !== 'IMAGE' ? Math.floor(Math.random() * 400) + 60 : undefined,
    tags: ['music', 'creative', creator.genres[0].toLowerCase()],
    genres: creator.genres,
    viewCount: Math.floor(Math.random() * 50000) + 100,
    likeCount: Math.floor(Math.random() * 5000) + 10,
    commentCount: Math.floor(Math.random() * 500) + 5,
    shareCount: Math.floor(Math.random() * 1000) + 5,
    price: visibilities[index % visibilities.length] === 'PREMIUM' ? Math.floor(Math.random() * 10) + 1 : undefined,
    currency: 'USD',
    createdAt: new Date(2024, 0, Math.floor(Math.random() * 21) + 1).toISOString(),
    updatedAt: new Date(2024, 0, Math.floor(Math.random() * 21) + 1).toISOString(),
    publishedAt: new Date(2024, 0, Math.floor(Math.random() * 21) + 1).toISOString(),
    isPublished: true,
    isLiked: Math.random() > 0.7,
  };
};

// Search results generator
export const generateSearchResults = (query: string, creators: CreatorInfo[], content: ContentItem[]) => {
  const queryLower = query.toLowerCase();
  
  const filteredCreators = creators.filter(creator => 
    creator.name.toLowerCase().includes(queryLower) ||
    creator.artistName?.toLowerCase().includes(queryLower) ||
    creator.bio?.toLowerCase().includes(queryLower) ||
    creator.genres.some(genre => genre.toLowerCase().includes(queryLower))
  );

  const filteredContent = content.filter(item => 
    item.title.toLowerCase().includes(queryLower) ||
    item.description?.toLowerCase().includes(queryLower) ||
    item.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
    item.genres.some(genre => genre.toLowerCase().includes(queryLower))
  );

  return {
    creators: filteredCreators,
    content: filteredContent,
    totalCreators: filteredCreators.length,
    totalContent: filteredContent.length,
    hasMore: false,
  };
};