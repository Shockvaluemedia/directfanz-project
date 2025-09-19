export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
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
  Profile: undefined;
  Analytics: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  ContentDetail: { contentId: string };
  CreatorProfile: { creatorId: string };
  Player: { contentId: string; playlist?: string[] };
};

export type DiscoverStackParamList = {
  DiscoverMain: undefined;
  Search: undefined;
  Category: { categoryId: string; categoryName: string };
  ContentDetail: { contentId: string };
  CreatorProfile: { creatorId: string };
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
