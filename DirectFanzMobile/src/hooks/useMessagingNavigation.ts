import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, MessagingStackParamList, MainTabParamList } from '../types/navigation';
import NavigationService from '../services/NavigationService';

// Type for main tab navigation
type MainTabNavigationProp = NativeStackNavigationProp<MainTabParamList>;

// Type for messaging stack navigation  
type MessagingNavigationProp = NativeStackNavigationProp<MessagingStackParamList>;

interface MessagingNavigationMethods {
  // Navigate to conversation list
  navigateToMessages: () => void;
  
  // Navigate to specific conversation
  navigateToConversation: (conversationId: string, participantName?: string) => void;
  
  // Navigate to new conversation
  navigateToNewConversation: (participantId?: string, participantName?: string) => void;
  
  // Navigate to profile from messaging context
  navigateToProfile: (userId: string) => void;
  
  // Navigate to conversation settings
  navigateToConversationSettings: (conversationId: string) => void;
  
  // Navigate to message search
  navigateToMessageSearch: (conversationId?: string) => void;
  
  // Navigate to media gallery
  navigateToMediaGallery: (conversationId: string, messageId?: string) => void;
  
  // Navigation state helpers
  isInMessagingSection: () => boolean;
  isInConversation: (conversationId?: string) => boolean;
  getCurrentConversationId: () => string | undefined;
}

export const useMessagingNavigation = (): MessagingNavigationMethods => {
  const navigation = useNavigation();

  const navigateToMessages = () => {
    NavigationService.navigateToMessages();
  };

  const navigateToConversation = (conversationId: string, participantName?: string) => {
    NavigationService.navigateToConversation(conversationId, participantName);
  };

  const navigateToNewConversation = (participantId?: string, participantName?: string) => {
    NavigationService.navigateToNewConversation(participantId, participantName);
  };

  const navigateToProfile = (userId: string) => {
    NavigationService.navigateToProfile(userId);
  };

  const navigateToConversationSettings = (conversationId: string) => {
    // If we're already in the messaging stack, navigate directly
    if (NavigationService.isInMessagingSection()) {
      (navigation as MessagingNavigationProp).navigate('ConversationSettings', { conversationId });
    } else {
      // Navigate to Messages tab first, then to settings
      NavigationService.navigate('Main');
      setTimeout(() => {
        NavigationService.navigate('Messages', {
          screen: 'ConversationSettings',
          params: { conversationId },
        });
      }, 100);
    }
  };

  const navigateToMessageSearch = (conversationId?: string) => {
    // If we're already in the messaging stack, navigate directly
    if (NavigationService.isInMessagingSection()) {
      (navigation as MessagingNavigationProp).navigate('MessageSearch', { conversationId });
    } else {
      // Navigate to Messages tab first, then to search
      NavigationService.navigate('Main');
      setTimeout(() => {
        NavigationService.navigate('Messages', {
          screen: 'MessageSearch',
          params: { conversationId },
        });
      }, 100);
    }
  };

  const navigateToMediaGallery = (conversationId: string, messageId?: string) => {
    // If we're already in the messaging stack, navigate directly
    if (NavigationService.isInMessagingSection()) {
      (navigation as MessagingNavigationProp).navigate('MediaGallery', { conversationId, messageId });
    } else {
      // Navigate to Messages tab first, then to media gallery
      NavigationService.navigate('Main');
      setTimeout(() => {
        NavigationService.navigate('Messages', {
          screen: 'MediaGallery',
          params: { conversationId, messageId },
        });
      }, 100);
    }
  };

  const isInMessagingSection = (): boolean => {
    return NavigationService.isInMessagingSection();
  };

  const isInConversation = (conversationId?: string): boolean => {
    if (!conversationId) {
      return NavigationService.getCurrentRouteName() === 'Chat';
    }
    return NavigationService.isInConversation(conversationId);
  };

  const getCurrentConversationId = (): string | undefined => {
    const routeName = NavigationService.getCurrentRouteName();
    const params = NavigationService.getCurrentRouteParams();
    
    if (routeName === 'Chat') {
      return params?.conversationId;
    }
    return undefined;
  };

  return {
    navigateToMessages,
    navigateToConversation,
    navigateToNewConversation,
    navigateToProfile,
    navigateToConversationSettings,
    navigateToMessageSearch,
    navigateToMediaGallery,
    isInMessagingSection,
    isInConversation,
    getCurrentConversationId,
  };
};

// Utility function to initiate conversation from profile/user context
export const startConversationWithUser = (userId: string, userName?: string) => {
  NavigationService.navigateToNewConversation(userId, userName);
};

// Utility function to message user directly (bypasses new conversation screen if possible)
export const messageUser = async (userId: string, userName?: string) => {
  // In a real app, you'd check if a conversation already exists with this user
  // For now, we'll navigate to new conversation
  NavigationService.navigateToNewConversation(userId, userName);
  
  // Future enhancement: Check existing conversations first
  // const existingConversationId = await findExistingConversation(userId);
  // if (existingConversationId) {
  //   NavigationService.navigateToConversation(existingConversationId, userName);
  // } else {
  //   NavigationService.navigateToNewConversation(userId, userName);
  // }
};

export default useMessagingNavigation;