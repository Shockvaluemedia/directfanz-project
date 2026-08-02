/**
 * Mobile Push Notifications Service
 * 
 * Firebase Cloud Messaging integration with notification handlers
 * and backend integration for sending notifications.
 * Requirements: 6.6
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Linking } from 'react-native';
import PushNotification from 'react-native-push-notification';
import { apiService } from './api';

// Types
export interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'content' | 'subscription' | 'payment' | 'system';
  data?: Record<string, any>;
  timestamp: number;
}

export interface NotificationSettings {
  enabled: boolean;
  messages: boolean;
  contentUpdates: boolean;
  subscriptions: boolean;
  payments: boolean;
  system: boolean;
  sound: boolean;
  vibration: boolean;
}

// Constants
const FCM_TOKEN_KEY = 'fcm_token';
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const NOTIFICATION_HISTORY_KEY = 'notification_history';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  messages: true,
  contentUpdates: true,
  subscriptions: true,
  payments: true,
  system: true,
  sound: true,
  vibration: true,
};

class MobileNotificationService {
  private fcmToken: string | null = null;
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();
      
      // Request permissions
      await this.requestPermissions();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Configure local notifications
      this.configureLocalNotifications();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Notification service initialization failed:', error);
    }
  }

  // Permission management
  private async requestPermissions(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                     authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('Push notification permissions not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // FCM Token management
  private async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        
        // Register token with backend
        await this.registerTokenWithBackend(token);
      }
      
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await apiService.request('/api/user/notifications/token', {
        method: 'POST',
        body: { 
          token, 
          platform: Platform.OS,
          deviceId: await this.getDeviceId()
        },
      });
    } catch (error) {
      console.error('Failed to register FCM token with backend:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch {
      return 'unknown';
    }
  }

  // Message handlers
  private setupMessageHandlers(): void {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message:', remoteMessage);
      await this.handleForegroundMessage(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Handle app opened from quit state
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from quit state:', remoteMessage);
        this.handleNotificationTap(remoteMessage);
      }
    });

    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      this.fcmToken = token;
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      await this.registerTokenWithBackend(token);
    });
  }

  private async handleBackgroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    const notification = this.parseRemoteMessage(remoteMessage);
    
    if (this.shouldShowNotification(notification)) {
      await this.saveNotificationToHistory(notification);
      this.showLocalNotification(notification);
    }
  }

  private async handleForegroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    const notification = this.parseRemoteMessage(remoteMessage);
    
    if (this.shouldShowNotification(notification)) {
      await this.saveNotificationToHistory(notification);
      
      // Show in-app notification or alert
      Alert.alert(
        notification.title,
        notification.body,
        [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'View', onPress: () => this.handleNotificationAction(notification) }
        ]
      );
    }
  }

  private handleNotificationTap(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    const notification = this.parseRemoteMessage(remoteMessage);
    this.handleNotificationAction(notification);
  }

  private parseRemoteMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): NotificationData {
    return {
      id: remoteMessage.messageId || Date.now().toString(),
      title: remoteMessage.notification?.title || 'DirectFanz',
      body: remoteMessage.notification?.body || '',
      type: (remoteMessage.data?.type as any) || 'system',
      data: remoteMessage.data,
      timestamp: Date.now(),
    };
  }

  // Local notifications
  private configureLocalNotifications(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Local notification token:', token);
      },
      onNotification: (notification) => {
        if (notification.userInteraction) {
          // User tapped notification
          this.handleLocalNotificationTap(notification);
        }
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'default',
          channelName: 'Default',
          channelDescription: 'Default notifications',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        () => {}
      );

      PushNotification.createChannel(
        {
          channelId: 'messages',
          channelName: 'Messages',
          channelDescription: 'New message notifications',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        () => {}
      );
    }
  }

  private showLocalNotification(notification: NotificationData): void {
    if (!this.settings.enabled) return;

    PushNotification.localNotification({
      id: notification.id,
      title: notification.title,
      message: notification.body,
      channelId: notification.type === 'message' ? 'messages' : 'default',
      soundName: this.settings.sound ? 'default' : undefined,
      vibrate: this.settings.vibration,
      userInfo: notification.data,
    });
  }

  private handleLocalNotificationTap(notification: any): void {
    // Handle local notification tap
    if (notification.userInfo) {
      this.handleNotificationAction({
        id: notification.id,
        title: notification.title,
        body: notification.message,
        type: notification.userInfo.type || 'system',
        data: notification.userInfo,
        timestamp: Date.now(),
      });
    }
  }

  // Notification actions
  private handleNotificationAction(notification: NotificationData): void {
    switch (notification.type) {
      case 'message':
        this.navigateToMessages(notification.data?.conversationId);
        break;
      case 'content':
        this.navigateToContent(notification.data?.contentId);
        break;
      case 'subscription':
        this.navigateToSubscriptions();
        break;
      case 'payment':
        this.navigateToPayments();
        break;
      default:
        // Handle generic notification
        break;
    }
  }

  private navigateToMessages(conversationId?: string): void {
    // Navigate to messages screen
    // This would integrate with your navigation system
    console.log('Navigate to messages:', conversationId);
  }

  private navigateToContent(contentId?: string): void {
    // Navigate to content screen
    console.log('Navigate to content:', contentId);
  }

  private navigateToSubscriptions(): void {
    // Navigate to subscriptions screen
    console.log('Navigate to subscriptions');
  }

  private navigateToPayments(): void {
    // Navigate to payments screen
    console.log('Navigate to payments');
  }

  // Settings management
  private async loadSettings(): Promise<void> {
    try {
      const settings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.settings));
      
      // Update backend preferences
      await apiService.request('/api/user/notifications/preferences', {
        method: 'PUT',
        body: this.settings,
      });
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  // Notification filtering
  private shouldShowNotification(notification: NotificationData): boolean {
    if (!this.settings.enabled) return false;

    switch (notification.type) {
      case 'message':
        return this.settings.messages;
      case 'content':
        return this.settings.contentUpdates;
      case 'subscription':
        return this.settings.subscriptions;
      case 'payment':
        return this.settings.payments;
      case 'system':
        return this.settings.system;
      default:
        return true;
    }
  }

  // Notification history
  private async saveNotificationToHistory(notification: NotificationData): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      history.unshift(notification);
      
      // Keep only last 100 notifications
      const trimmed = history.slice(0, 100);
      
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save notification to history:', error);
    }
  }

  async getNotificationHistory(): Promise<NotificationData[]> {
    try {
      const history = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear notification history:', error);
    }
  }

  // Public API
  async sendTestNotification(): Promise<void> {
    const testNotification: NotificationData = {
      id: 'test_' + Date.now(),
      title: 'Test Notification',
      body: 'This is a test notification from DirectFanz',
      type: 'system',
      timestamp: Date.now(),
    };

    this.showLocalNotification(testNotification);
  }

  getFCMToken(): string | null {
    return this.fcmToken;
  }

  isInitialized(): boolean {
    return this.isInitialized;
  }

  async openSettings(): Promise<void> {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }
}

// Export singleton instance
export const notificationService = new MobileNotificationService();
export default notificationService;