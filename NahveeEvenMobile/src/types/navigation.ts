export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
  Player: { contentId: string; content?: any };
  ContentPreview: { content: any };
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Upload: undefined;
  Messages: undefined;
  Profile: undefined;
  Analytics: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  ContentDetail: { contentId: string; content?: any };
  CreatorProfile: { creatorId: string };
  Player: { contentId: string; content?: any; playlist?: string[] };
  Categories: undefined;
  Trending: undefined;
  Search: undefined;
};

export type DiscoverStackParamList = {
  DiscoverMain: undefined;
  Search: undefined;
  Category: { categoryId: string; categoryName: string };
  ContentDetail: { contentId: string; content?: any };
  CreatorProfile: { creatorId: string };
  ViewCreatorProfile: { creatorId: string };
  Trending: undefined;
  Categories: undefined;
};

export type UploadStackParamList = {
  UploadMain: undefined;
  UploadMedia: undefined;
  UploadDetails: { mediaUri: string; mediaType: 'audio' | 'video' | 'image' };
  UploadPreview: {
    mediaUri: string;
    title: string;
    description: string;
    tags: string[];
    price?: number;
  };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Subscriptions: undefined;
  Purchases: undefined;
  Help: undefined;
  About: undefined;
};

export type AnalyticsStackParamList = {
  AnalyticsMain: undefined;
  DetailedAnalytics: { metric: string };
};

export type MessagingStackParamList = {
  ConversationList: undefined;
  Chat: { conversationId: string; participantName?: string };
  NewConversation: { participantId?: string; participantName?: string };
  ConversationSettings: { conversationId: string };
  MessageSearch: { conversationId?: string };
  MediaGallery: { conversationId: string; messageId?: string };
};
