import { NavigationContainerRef, StackActions } from '@react-navigation/native';
import { RootStackParamList, MessagingStackParamList } from '../types/navigation';

export type NavigationServiceRef = NavigationContainerRef<RootStackParamList>;

class NavigationService {
  private navigationRef: NavigationServiceRef | null = null;

  // Set the navigation reference (called from App.tsx)
  setNavigationRef(ref: NavigationServiceRef) {
    this.navigationRef = ref;
  }

  // Check if navigation is ready
  isReady(): boolean {
    return this.navigationRef?.isReady() ?? false;
  }

  // Navigate to a route
  navigate(routeName: string, params?: any) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.navigate(routeName as never, params as never);
    }
  }

  // Go back
  goBack() {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.goBack();
    }
  }

  // Reset navigation stack
  reset(routes: { name: string; params?: any }[]) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.reset({
        index: routes.length - 1,
        routes,
      });
    }
  }

  // Push a screen onto the stack
  push(routeName: string, params?: any) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.dispatch(StackActions.push(routeName, params));
    }
  }

  // Pop screens from the stack
  pop(count: number = 1) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.dispatch(StackActions.pop(count));
    }
  }

  // Messaging-specific navigation methods
  navigateToConversation(conversationId: string, participantName?: string) {
    if (this.navigationRef?.isReady()) {
      // Navigate to Messages tab first, then to specific conversation
      this.navigationRef.navigate('Main' as never);
      
      // Wait a tick for tab navigation to complete, then navigate to chat
      setTimeout(() => {
        if (this.navigationRef?.isReady()) {
          this.navigationRef.navigate('Messages' as never, {
            screen: 'Chat',
            params: { conversationId, participantName },
          } as never);
        }
      }, 100);
    }
  }

  navigateToMessages() {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.navigate('Main' as never);
      
      setTimeout(() => {
        if (this.navigationRef?.isReady()) {
          this.navigationRef.navigate('Messages' as never, {
            screen: 'ConversationList',
          } as never);
        }
      }, 100);
    }
  }

  // Navigate to new conversation with specific participant
  navigateToNewConversation(participantId?: string, participantName?: string) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.navigate('Main' as never);
      
      setTimeout(() => {
        if (this.navigationRef?.isReady()) {
          this.navigationRef.navigate('Messages' as never, {
            screen: 'NewConversation',
            params: { participantId, participantName },
          } as never);
        }
      }, 100);
    }
  }

  // Navigate to profile from messaging context
  navigateToProfile(userId: string) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.navigate('Main' as never);
      
      setTimeout(() => {
        if (this.navigationRef?.isReady()) {
          this.navigationRef.navigate('Discover' as never, {
            screen: 'CreatorProfile',
            params: { creatorId: userId },
          } as never);
        }
      }, 100);
    }
  }

  // Handle deep links from notifications
  handleNotificationNavigation(notificationData: any) {
    if (!this.isReady() || !notificationData) return;

    const { type, conversationId, messageId, senderId, participantName } = notificationData;

    switch (type) {
      case 'message':
        if (conversationId) {
          this.navigateToConversation(conversationId, participantName);
        }
        break;

      case 'typing':
        if (conversationId) {
          this.navigateToConversation(conversationId, participantName);
        }
        break;

      case 'conversation_invite':
        if (conversationId) {
          this.navigateToConversation(conversationId, participantName);
        }
        break;

      case 'new_message_request':
        if (senderId) {
          this.navigateToNewConversation(senderId, participantName);
        }
        break;

      default:
        // Default to messages list
        this.navigateToMessages();
        break;
    }
  }

  // Get current route name
  getCurrentRouteName(): string | undefined {
    if (this.navigationRef?.isReady()) {
      return this.navigationRef.getCurrentRoute()?.name;
    }
    return undefined;
  }

  // Get current route params
  getCurrentRouteParams(): any {
    if (this.navigationRef?.isReady()) {
      return this.navigationRef.getCurrentRoute()?.params;
    }
    return undefined;
  }

  // Check if currently in messaging section
  isInMessagingSection(): boolean {
    const routeName = this.getCurrentRouteName();
    return routeName === 'Messages' || routeName?.includes('Chat') || false;
  }

  // Check if currently in specific conversation
  isInConversation(conversationId: string): boolean {
    const routeName = this.getCurrentRouteName();
    const params = this.getCurrentRouteParams();
    
    return routeName === 'Chat' && params?.conversationId === conversationId;
  }
}

// Export singleton instance
const navigationService = new NavigationService();
export default navigationService;