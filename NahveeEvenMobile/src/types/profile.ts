export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ARTIST' | 'FAN' | 'ADMIN';
  avatar?: string;
  verified: boolean;
  
  // Profile Information
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
  birthDate?: string;
  phoneNumber?: string;
  
  // Creator-specific fields
  artistName?: string;
  genres?: string[];
  subscriptionTiers?: SubscriptionTier[];
  
  // Statistics
  stats?: UserStats;
  
  // Settings
  preferences?: UserPreferences;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  spotify?: string;
  soundcloud?: string;
  facebook?: string;
  website?: string;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
  isActive: boolean;
}

export interface UserStats {
  // For Artists
  totalSubscribers?: number;
  monthlyRevenue?: number;
  totalEarnings?: number;
  contentCount?: number;
  averageRating?: number;
  totalViews?: number;
  totalLikes?: number;
  
  // For Fans
  subscriptionsCount?: number;
  totalSpent?: number;
  favoriteCreators?: string[];
  totalPurchases?: number;
}

export interface UserPreferences {
  // Notification settings
  notifications: NotificationPreferences;
  
  // Privacy settings
  privacy: PrivacyPreferences;
  
  // App settings
  app: AppPreferences;
  
  // Content preferences
  content: ContentPreferences;
}

export interface NotificationPreferences {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  
  // Specific notification types
  newSubscriber: boolean;
  newMessage: boolean;
  contentLiked: boolean;
  paymentReceived: boolean;
  subscriptionExpiring: boolean;
  newContentFromCreators: boolean;
  weeklyDigest: boolean;
  promotional: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: 'PUBLIC' | 'PRIVATE' | 'SUBSCRIBERS_ONLY';
  showEmail: boolean;
  showLocation: boolean;
  showOnlineStatus: boolean;
  allowDirectMessages: 'EVERYONE' | 'SUBSCRIBERS_ONLY' | 'NONE';
  showSubscriberCount: boolean;
  showEarnings: boolean;
}

export interface AppPreferences {
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  currency: string;
  autoPlayVideos: boolean;
  downloadQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  biometricAuth: boolean;
  twoFactorAuth: boolean;
}

export interface ContentPreferences {
  preferredGenres: string[];
  contentFilter: 'ALL' | 'MILD' | 'STRICT';
  autoDownloadSubscriptions: boolean;
  showExplicitContent: boolean;
  preferredLanguages: string[];
}

// Form data types for editing
export interface ProfileEditData {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  artistName?: string;
  genres?: string[];
  socialLinks?: Partial<SocialLinks>;
  birthDate?: string;
  phoneNumber?: string;
}

export interface AvatarUpdateData {
  avatar: string;
}

export interface PasswordUpdateData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface EmailUpdateData {
  newEmail: string;
  password: string;
}

// API response types
export interface ProfileResponse {
  success: boolean;
  data: UserProfile;
  message?: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  data: UserProfile;
  message?: string;
}

// Profile validation schemas
export interface ProfileValidationErrors {
  name?: string;
  bio?: string;
  website?: string;
  artistName?: string;
  phoneNumber?: string;
  socialLinks?: Partial<Record<keyof SocialLinks, string>>;
}

// Profile action types
export type ProfileAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_VALIDATION_ERRORS'; payload: ProfileValidationErrors | null }
  | { type: 'CLEAR_ERRORS' };

export interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  isEditing: boolean;
  error: string | null;
  validationErrors: ProfileValidationErrors | null;
}