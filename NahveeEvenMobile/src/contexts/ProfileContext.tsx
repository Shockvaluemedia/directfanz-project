import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  UserProfile,
  ProfileState,
  ProfileAction,
  ProfileEditData,
  AvatarUpdateData,
  PasswordUpdateData,
  EmailUpdateData,
  ProfileValidationErrors,
  UserPreferences,
} from '../types/profile';
import { validateProfileData } from '../utils/profileValidation';

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  isEditing: false,
  error: null,
  validationErrors: null,
};

const profileReducer = (state: ProfileState, action: ProfileAction): ProfileState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload, isLoading: false, error: null };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        profile: state.profile ? { ...state.profile, ...action.payload } : null,
        isLoading: false,
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };
    case 'CLEAR_ERRORS':
      return { ...state, error: null, validationErrors: null };
    default:
      return state;
  }
};

interface ProfileContextType extends ProfileState {
  // Profile actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: ProfileEditData) => Promise<void>;
  updateAvatar: (data: AvatarUpdateData) => Promise<void>;
  updatePassword: (data: PasswordUpdateData) => Promise<void>;
  updateEmail: (data: EmailUpdateData) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  
  // Utility actions
  clearErrors: () => void;
  validateProfile: (data: ProfileEditData) => ProfileValidationErrors | null;
  
  // Mock data helpers (remove when API is ready)
  loadMockProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

const STORAGE_KEYS = {
  PROFILE: '@nahvee_even_profile',
  PREFERENCES: '@nahvee_even_preferences',
};

// Mock data for development
const createMockProfile = (authUser: any): UserProfile => {
  const isArtist = authUser.role === 'ARTIST';
  
  return {
    id: authUser.id,
    email: authUser.email,
    name: authUser.name,
    role: authUser.role,
    avatar: authUser.avatar,
    verified: authUser.verified,
    
    bio: isArtist 
      ? "🎵 Independent artist creating music that speaks to the soul. Join me on this creative journey!"
      : "Music lover and supporter of independent artists. Always looking for fresh sounds!",
    location: "Los Angeles, CA",
    website: isArtist ? "https://example-artist.com" : undefined,
    artistName: isArtist ? `${authUser.name.split(' ')[0]} Music` : undefined,
    genres: isArtist ? ["R&B", "Hip-Hop", "Soul"] : undefined,
    
    socialLinks: {
      instagram: isArtist ? "@artisthandle" : "@fanhandle",
      twitter: isArtist ? "@artisttwitter" : undefined,
      spotify: isArtist ? "artist/spotify-id" : undefined,
    },
    
    stats: isArtist ? {
      totalSubscribers: 1234,
      monthlyRevenue: 2500,
      totalEarnings: 15600,
      contentCount: 45,
      averageRating: 4.8,
      totalViews: 89234,
      totalLikes: 5670,
    } : {
      subscriptionsCount: 8,
      totalSpent: 156.50,
      totalPurchases: 23,
    },
    
    preferences: {
      notifications: {
        pushNotifications: true,
        emailNotifications: true,
        smsNotifications: false,
        newSubscriber: true,
        newMessage: true,
        contentLiked: true,
        paymentReceived: true,
        subscriptionExpiring: true,
        newContentFromCreators: true,
        weeklyDigest: true,
        promotional: false,
      },
      privacy: {
        profileVisibility: 'PUBLIC',
        showEmail: false,
        showLocation: true,
        showOnlineStatus: true,
        allowDirectMessages: 'SUBSCRIBERS_ONLY',
        showSubscriberCount: true,
        showEarnings: false,
      },
      app: {
        theme: 'SYSTEM',
        language: 'en',
        currency: 'USD',
        autoPlayVideos: true,
        downloadQuality: 'HIGH',
        biometricAuth: false,
        twoFactorAuth: false,
      },
      content: {
        preferredGenres: isArtist ? ["R&B", "Hip-Hop"] : ["R&B", "Hip-Hop", "Pop", "Soul"],
        contentFilter: 'MILD',
        autoDownloadSubscriptions: false,
        showExplicitContent: true,
        preferredLanguages: ['en'],
      },
    },
    
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
};

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(profileReducer, initialState);
  const { user, token } = useAuth();

  // Load profile when user changes
  useEffect(() => {
    if (user) {
      loadMockProfile();
    } else {
      dispatch({ type: 'SET_PROFILE', payload: null as any });
    }
  }, [user]);

  const fetchProfile = async (): Promise<void> => {
    if (!user || !token) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      dispatch({ type: 'SET_PROFILE', payload: data.profile });
      
      // Cache profile data
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data.profile));
    } catch (error) {
      console.error('Fetch profile error:', error);
      // Fallback to mock data for development
      loadMockProfile();
    }
  };

  const updateProfile = async (data: ProfileEditData): Promise<void> => {
    if (!user || !token || !state.profile) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      // Validate data
      const validationErrors = validateProfileData(data);
      if (validationErrors) {
        dispatch({ type: 'SET_VALIDATION_ERRORS', payload: validationErrors });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();
      dispatch({ type: 'UPDATE_PROFILE', payload: result.profile });
      
      // Update cached data
      const updatedProfile = { ...state.profile, ...result.profile };
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error('Update profile error:', error);
      // For development, update locally
      dispatch({ type: 'UPDATE_PROFILE', payload: data });
      const updatedProfile = { ...state.profile, ...data };
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updatedProfile));
    }
  };

  const updateAvatar = async (data: AvatarUpdateData): Promise<void> => {
    if (!user || !token) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      // TODO: Replace with actual API call that handles file upload
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}/avatar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update avatar');
      }

      const result = await response.json();
      dispatch({ type: 'UPDATE_PROFILE', payload: { avatar: result.avatar } });
    } catch (error) {
      console.error('Update avatar error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update avatar' });
    }
  };

  const updatePassword = async (data: PasswordUpdateData): Promise<void> => {
    if (!user || !token) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      if (data.newPassword !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update password');
      }

      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('Update password error:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update password' });
    }
  };

  const updateEmail = async (data: EmailUpdateData): Promise<void> => {
    if (!user || !token) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}/email`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update email');
      }

      const result = await response.json();
      dispatch({ type: 'UPDATE_PROFILE', payload: { email: result.email } });
    } catch (error) {
      console.error('Update email error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update email' });
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<void> => {
    if (!user || !token || !state.profile) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERRORS' });

      // TODO: Replace with actual API call
      const response = await fetch(`http://localhost:3000/api/profile/${user.id}/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const result = await response.json();
      dispatch({ type: 'UPDATE_PROFILE', payload: { preferences: result.preferences } });
      
      // Update cached preferences
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(result.preferences));
    } catch (error) {
      console.error('Update preferences error:', error);
      // For development, update locally
      const updatedPreferences = { ...state.profile.preferences, ...preferences };
      dispatch({ type: 'UPDATE_PROFILE', payload: { preferences: updatedPreferences } });
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updatedPreferences));
    }
  };

  const clearErrors = () => {
    dispatch({ type: 'CLEAR_ERRORS' });
  };

  const validateProfile = (data: ProfileEditData): ProfileValidationErrors | null => {
    return validateProfileData(data);
  };

  const loadMockProfile = () => {
    if (user) {
      const mockProfile = createMockProfile(user);
      dispatch({ type: 'SET_PROFILE', payload: mockProfile });
      AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));
    }
  };

  const value: ProfileContextType = {
    ...state,
    fetchProfile,
    updateProfile,
    updateAvatar,
    updatePassword,
    updateEmail,
    updatePreferences,
    clearErrors,
    validateProfile,
    loadMockProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};