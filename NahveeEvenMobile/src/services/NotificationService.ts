import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageNotification } from '../types/messaging';
import NavigationService from './NavigationService';

export interface NotificationServiceConfig {
  channelId?: string;
  channelName?: string;
  channelDescription?: string;
  sound?: boolean;
  vibration?: boolean;
  badge?: boolean;
}

export interface NotificationHandlers {
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
  onTokenReceived?: (token: string) => void;
  onTokenError?: (error: Error) => void;
}

class NotificationService {
  private config: NotificationServiceConfig;
  private handlers: NotificationHandlers;
  private isInitialized = false;
  private pushToken: string | null = null;

  constructor(config: NotificationServiceConfig = {}, handlers: NotificationHandlers = {}) {
    this.config = {
      channelId: 'messaging',
      channelName: 'Messages',
      channelDescription: 'New message notifications',
      sound: true,
      vibration: true,
      badge: true,
      ...config,
    };
    this.handlers = handlers;
  }

  // Initialization
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure notification behavior
      await this.configureNotifications();

      // Create notification channel (Android)
      await this.createNotificationChannel();

      // Register for push notifications
      await this.registerForPushNotifications();

      // Set up notification listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    // Remove notification listeners
    Notifications.removeNotificationSubscription;
    this.isInitialized = false;
  }

  // Push token management
  public async getPushToken(): Promise<string | null> {
    if (this.pushToken) {
      return this.pushToken;
    }

    try {
      const token = await AsyncStorage.getItem('push_token');
      if (token) {
        this.pushToken = token;
        return token;
      }
    } catch (error) {
      console.error('Error retrieving stored push token:', error);
    }

    return null;
  }

  public async refreshPushToken(): Promise<string | null> {
    this.pushToken = null;
    return await this.registerForPushNotifications();
  }

  // Local notifications
  public async showMessageNotification(messageNotification: MessageNotification): Promise<void> {
    try {
      const { senderName, content, conversationId, messageId, type } = messageNotification;
      
      // Check if we should show the notification
      const shouldShow = await this.shouldShowNotification(conversationId);
      if (!shouldShow) return;

      // Format notification content
      const notificationContent = this.formatNotificationContent(content, type);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: senderName,
          body: notificationContent,
          data: {
            conversationId,
            messageId,
            type: 'message',
            senderId: messageNotification.senderId,
          },
          sound: this.config.sound ? 'default' : undefined,
          badge: this.config.badge ? await this.getUnreadCount() + 1 : undefined,
        },
        trigger: null, // Show immediately
      });

      // Update badge count
      if (this.config.badge) {
        await this.updateBadgeCount();
      }
    } catch (error) {
      console.error('Error showing message notification:', error);
    }
  }

  public async showTypingNotification(senderName: string, conversationId: string): Promise<void> {
    // Only show typing notifications for important conversations
    const shouldShow = await this.shouldShowTypingNotification(conversationId);
    if (!shouldShow) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${senderName} is typing...`,
          body: '',
          data: {
            conversationId,
            type: 'typing',
          },
          sound: false, // No sound for typing notifications
          badge: false,
        },
        trigger: null,
      });

      // Auto-dismiss after 3 seconds
      setTimeout(async () => {
        await this.dismissTypingNotification(conversationId);
      }, 3000);
    } catch (error) {
      console.error('Error showing typing notification:', error);
    }
  }

  public async dismissTypingNotification(conversationId: string): Promise<void> {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      for (const notification of notifications) {
        const data = notification.request.content.data;
        if (data?.type === 'typing' && data?.conversationId === conversationId) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
        }
      }
    } catch (error) {
      console.error('Error dismissing typing notification:', error);
    }
  }

  public async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await this.setBadgeCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  public async clearConversationNotifications(conversationId: string): Promise<void> {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      for (const notification of notifications) {
        const data = notification.request.content.data;
        if (data?.conversationId === conversationId) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
        }
      }
    } catch (error) {
      console.error('Error clearing conversation notifications:', error);
    }
  }

  // Badge management
  public async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      await AsyncStorage.setItem('badge_count', count.toString());
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  public async updateBadgeCount(): Promise<void> {
    try {
      const unreadCount = await this.getUnreadCount();
      await this.setBadgeCount(unreadCount);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  // Permission management
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: this.config.badge,
            allowSound: this.config.sound,
            allowDisplayInCarPlay: false,
            allowCriticalAlerts: false,
            provideAppNotificationSettings: true,
            allowProvisional: false,
            allowAnnouncements: false,
          },
          android: {
            allowAlert: true,
            allowBadge: this.config.badge,
            allowSound: this.config.sound,
          },
        });
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  public async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'denied';
    }
  }

  // Private methods
  private async configureNotifications(): Promise<void> {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Check if app is in foreground
        const appState = await this.getAppState();
        
        return {
          shouldShowAlert: appState !== 'active',
          shouldPlaySound: this.config.sound ?? true,
          shouldSetBadge: this.config.badge ?? true,
        };
      },
    });
  }

  private async createNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(this.config.channelId!, {
        name: this.config.channelName!,
        description: this.config.channelDescription,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: this.config.vibration ? [0, 250, 250, 250] : undefined,
        sound: this.config.sound ? 'default' : undefined,
        enableLights: true,
        lightColor: '#0080FF',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  private async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        this.handlers.onTokenError?.(new Error('Notification permissions denied'));
        return null;
      }

      // Get token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      
      const token = tokenData.data;
      this.pushToken = token;
      
      // Store token
      await AsyncStorage.setItem('push_token', token);
      
      // Notify handlers
      this.handlers.onTokenReceived?.(token);
      
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      this.handlers.onTokenError?.(error as Error);
      return null;
    }
  }

  private setupNotificationListeners(): void {
    // Handle notifications received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      this.handlers.onNotificationReceived?.(notification);
    });

    // Handle notification responses (taps)
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      
      // Handle automatic navigation for messaging notifications
      const notificationData = response.notification.request.content.data;
      if (notificationData) {
        // Use NavigationService to navigate to the appropriate screen
        NavigationService.handleNotificationNavigation(notificationData);
      }
      
      // Call custom handler if provided
      this.handlers.onNotificationResponse?.(response);
    });
  }

  private formatNotificationContent(content: string, type: string): string {
    switch (type) {
      case 'IMAGE':
        return '📷 Photo';
      case 'VIDEO':
        return '🎥 Video';
      case 'AUDIO':
        return '🎵 Audio';
      case 'FILE':
        return '📎 File';
      default:
        return content.length > 100 ? content.substring(0, 97) + '...' : content;
    }
  }

  private async shouldShowNotification(conversationId: string): Promise<boolean> {
    try {
      // Check if notifications are enabled for this conversation
      const mutedConversations = await AsyncStorage.getItem('muted_conversations');
      if (mutedConversations) {
        const muted = JSON.parse(mutedConversations);
        if (muted.includes(conversationId)) {
          return false;
        }
      }

      // Check if user is currently viewing this conversation
      const activeConversation = await AsyncStorage.getItem('active_conversation');
      if (activeConversation === conversationId) {
        const appState = await this.getAppState();
        return appState !== 'active';
      }

      return true;
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return true; // Default to showing notifications
    }
  }

  private async shouldShowTypingNotification(conversationId: string): Promise<boolean> {
    try {
      // Only show typing notifications for priority conversations
      const priorityConversations = await AsyncStorage.getItem('priority_conversations');
      if (priorityConversations) {
        const priority = JSON.parse(priorityConversations);
        return priority.includes(conversationId);
      }
      return false;
    } catch (error) {
      console.error('Error checking typing notification settings:', error);
      return false;
    }
  }

  private async getUnreadCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem('unread_count');
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  private async getAppState(): Promise<string> {
    // This would typically come from React Native's AppState
    // For now, return a mock value
    return 'active';
  }

  // Update handlers
  public updateHandlers(newHandlers: Partial<NotificationHandlers>): void {
    this.handlers = { ...this.handlers, ...newHandlers };
  }

  // Update config
  public updateConfig(newConfig: Partial<NotificationServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default NotificationService;