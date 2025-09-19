/**
 * Notification Service - Push Notifications for Mobile
 *
 * This service provides comprehensive push notification functionality:
 * - Push notification setup and device token management
 * - Local and remote notification handling
 * - Notification categories and actions
 * - Background notification processing
 * - Deep linking from notifications
 * - Notification scheduling and management
 * - Rich media notifications
 * - Interactive notification actions
 */

import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

// Types
export interface NotificationData {
  id?: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  category?: string;
  sound?: string;
  badge?: number;
  priority?: 'default' | 'high' | 'max';
  largeIcon?: string;
  bigPictureUrl?: string;
  channelId?: string;
  scheduledDate?: Date;
  repeatInterval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface NotificationAction {
  id: string;
  title: string;
  options?: {
    foreground?: boolean;
    authenticationRequired?: boolean;
    destructive?: boolean;
  };
}

export interface NotificationChannel {
  channelId: string;
  channelName: string;
  channelDescription?: string;
  playSound?: boolean;
  soundName?: string;
  importance?: 'default' | 'high' | 'low' | 'min';
  vibrate?: boolean;
  showBadge?: boolean;
  enableLights?: boolean;
  lightColor?: string;
}

export interface NotificationPermissions {
  alert: boolean;
  badge: boolean;
  sound: boolean;
  announcement: boolean;
  carPlay: boolean;
  criticalAlert: boolean;
  provisional: boolean;
}

class NotificationService extends EventEmitter {
  private isInitialized = false;
  private deviceToken: string | null = null;
  private notificationChannels: NotificationChannel[] = [];
  private pendingNotifications: NotificationData[] = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request permissions
      await this.requestPermissions();

      // Configure push notifications
      await this.configurePushNotifications();

      // Setup notification channels (Android)
      if (Platform.OS === 'android') {
        await this.setupNotificationChannels();
      }

      // Setup listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('NotificationService initialization failed:', error);
      throw error;
    }
  }

  async requestPermissions(): Promise<NotificationPermissions> {
    try {
      let permissions: NotificationPermissions;

      if (Platform.OS === 'ios') {
        // iOS permissions through PushNotificationIOS
        const iosPermissions = await PushNotificationIOS.requestPermissions({
          alert: true,
          badge: true,
          sound: true,
        });

        permissions = {
          alert: iosPermissions.alert || false,
          badge: iosPermissions.badge || false,
          sound: iosPermissions.sound || false,
          announcement: false,
          carPlay: false,
          criticalAlert: false,
          provisional: false,
        };
      } else {
        // Android permissions
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'This app needs access to send you notifications',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        permissions = {
          alert: granted === PermissionsAndroid.RESULTS.GRANTED,
          badge: true,
          sound: true,
          announcement: false,
          carPlay: false,
          criticalAlert: false,
          provisional: false,
        };
      }

      // Save permissions
      await AsyncStorage.setItem('@NotificationService:permissions', JSON.stringify(permissions));

      console.log('Notification permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('Request permissions failed:', error);
      // Return default permissions on error
      const defaultPermissions: NotificationPermissions = {
        alert: false,
        badge: false,
        sound: false,
        announcement: false,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
      };
      return defaultPermissions;
    }
  }

  private async configurePushNotifications(): Promise<void> {
    // Configure React Native Push Notification
    PushNotification.configure({
      // Called when token is generated (iOS and Android)
      onRegister: token => {
        console.log('Push notification token:', token.token);
        this.deviceToken = token.token;
        this.emit('tokenReceived', token.token);
        this.saveDeviceToken(token.token);
      },

      // Called when a remote or local notification is opened or received
      onNotification: notification => {
        console.log('Notification received:', notification);
        this.handleNotification(notification);

        // Required on iOS only
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      // Called when action is pressed
      onAction: notification => {
        console.log('Notification action:', notification.action);
        this.handleNotificationAction(notification);
      },

      // Called when the user fails to register for remote notifications
      onRegistrationError: error => {
        console.error('Push notification registration error:', error);
        this.emit('registrationError', error);
      },

      // IOS ONLY
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // (optional) default: true
      requestPermissions: true,
    });
  }

  private async setupNotificationChannels(): Promise<void> {
    const defaultChannels: NotificationChannel[] = [
      {
        channelId: 'default',
        channelName: 'Default',
        channelDescription: 'Default notification channel',
        playSound: true,
        importance: 'default',
        vibrate: true,
        showBadge: true,
      },
      {
        channelId: 'music',
        channelName: 'Music Playback',
        channelDescription: 'Music playback controls and updates',
        playSound: false,
        importance: 'low',
        vibrate: false,
        showBadge: false,
      },
      {
        channelId: 'social',
        channelName: 'Social Updates',
        channelDescription: 'Messages, likes, and social interactions',
        playSound: true,
        importance: 'high',
        vibrate: true,
        showBadge: true,
      },
      {
        channelId: 'streaming',
        channelName: 'Live Streaming',
        channelDescription: 'Live stream notifications and updates',
        playSound: true,
        importance: 'high',
        vibrate: true,
        showBadge: true,
        enableLights: true,
        lightColor: '#FF0000',
      },
    ];

    for (const channel of defaultChannels) {
      PushNotification.createChannel(
        {
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelDescription: channel.channelDescription,
          playSound: channel.playSound,
          soundName: channel.soundName || 'default',
          importance: channel.importance === 'high' ? 4 : 3,
          vibrate: channel.vibrate,
          showBadge: channel.showBadge,
        },
        created => console.log(`Channel ${channel.channelId} created: ${created}`)
      );
    }

    this.notificationChannels = defaultChannels;
  }

  private setupNotificationListeners(): void {
    // Firebase messaging listeners
    messaging().onMessage(async remoteMessage => {
      console.log('FCM message received in foreground:', remoteMessage);

      // Show local notification when app is in foreground
      await this.showLocalNotification({
        title: remoteMessage.notification?.title || 'New Message',
        message: remoteMessage.notification?.body || 'You have a new message',
        data: remoteMessage.data,
        channelId: 'default',
      });
    });

    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      this.handleDeepLink(remoteMessage.data);
    });

    // Check whether an initial notification is available
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          this.handleDeepLink(remoteMessage.data);
        }
      });

    // Background message handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message handled in the background!', remoteMessage);

      // Process background notification
      await this.processBackgroundNotification(remoteMessage);
    });
  }

  // Public methods
  async setupPushNotifications(): Promise<string | null> {
    try {
      // Get FCM token
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);

      if (fcmToken) {
        this.deviceToken = fcmToken;
        await this.saveDeviceToken(fcmToken);
        await this.registerDeviceToken(fcmToken);
        this.emit('tokenReceived', fcmToken);
        return fcmToken;
      }

      return null;
    } catch (error) {
      console.error('Setup push notifications failed:', error);
      throw error;
    }
  }

  async showLocalNotification(notification: NotificationData): Promise<void> {
    try {
      const notificationId = notification.id || Date.now().toString();

      PushNotification.localNotification({
        id: notificationId,
        title: notification.title,
        message: notification.message,
        playSound: true,
        soundName: notification.sound || 'default',
        number: notification.badge,
        userInfo: notification.data,
        actions: notification.actions?.map(action => action.id) || [],
        category: notification.category,
        channelId: notification.channelId || 'default',
        priority: notification.priority === 'high' ? 'high' : 'default',
        largeIcon: notification.largeIcon,
        bigPictureUrl: notification.bigPictureUrl,
      });

      console.log('Local notification shown:', notificationId);
    } catch (error) {
      console.error('Show local notification failed:', error);
      throw error;
    }
  }

  async scheduleNotification(notification: NotificationData): Promise<void> {
    try {
      if (!notification.scheduledDate) {
        throw new Error('Scheduled date is required for scheduled notifications');
      }

      const notificationId = notification.id || Date.now().toString();

      PushNotification.localNotificationSchedule({
        id: notificationId,
        title: notification.title,
        message: notification.message,
        date: notification.scheduledDate,
        repeatType: notification.repeatInterval,
        playSound: true,
        soundName: notification.sound || 'default',
        number: notification.badge,
        userInfo: notification.data,
        actions: notification.actions?.map(action => action.id) || [],
        category: notification.category,
        channelId: notification.channelId || 'default',
      });

      console.log('Notification scheduled:', notificationId, notification.scheduledDate);
    } catch (error) {
      console.error('Schedule notification failed:', error);
      throw error;
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      PushNotification.cancelLocalNotifications({ id: notificationId });
      console.log('Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Cancel notification failed:', error);
      throw error;
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      PushNotification.cancelAllLocalNotifications();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Cancel all notifications failed:', error);
      throw error;
    }
  }

  async getScheduledNotifications(): Promise<any[]> {
    return new Promise(resolve => {
      PushNotification.getScheduledLocalNotifications(notifications => {
        resolve(notifications);
      });
    });
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        PushNotificationIOS.setApplicationIconBadgeNumber(count);
      } else {
        PushNotification.setApplicationIconBadgeNumber(count);
      }
      console.log('Badge count set to:', count);
    } catch (error) {
      console.error('Set badge count failed:', error);
      throw error;
    }
  }

  async getBadgeCount(): Promise<number> {
    return new Promise(resolve => {
      if (Platform.OS === 'ios') {
        PushNotificationIOS.getApplicationIconBadgeNumber(count => {
          resolve(count);
        });
      } else {
        resolve(0); // Android doesn't have a built-in way to get badge count
      }
    });
  }

  // Private methods
  private async handleNotification(notification: any): Promise<void> {
    try {
      console.log('Handling notification:', notification);

      // Update badge count
      if (notification.badge) {
        await this.setBadgeCount(notification.badge);
      }

      // Handle deep link if present
      if (notification.data) {
        this.handleDeepLink(notification.data);
      }

      // Emit notification received event
      this.emit('notificationReceived', notification);
    } catch (error) {
      console.error('Handle notification failed:', error);
    }
  }

  private async handleNotificationAction(notification: any): Promise<void> {
    try {
      console.log('Handling notification action:', notification.action, notification);

      // Handle specific actions
      switch (notification.action) {
        case 'play':
          this.emit('playAction', notification.userInfo);
          break;
        case 'pause':
          this.emit('pauseAction', notification.userInfo);
          break;
        case 'skip':
          this.emit('skipAction', notification.userInfo);
          break;
        case 'like':
          this.emit('likeAction', notification.userInfo);
          break;
        case 'reply':
          this.emit('replyAction', notification.userInfo);
          break;
        default:
          this.emit('customAction', notification.action, notification.userInfo);
      }

      // Emit general action event
      this.emit('notificationAction', notification);
    } catch (error) {
      console.error('Handle notification action failed:', error);
    }
  }

  private handleDeepLink(data: Record<string, any> | undefined): void {
    try {
      if (!data) return;

      console.log('Handling deep link:', data);

      // Extract deep link information
      const { type, id, url, screen } = data;

      // Handle different deep link types
      switch (type) {
        case 'track':
          this.emit('deepLink', { screen: 'Player', params: { trackId: id } });
          break;
        case 'stream':
          this.emit('deepLink', { screen: 'Streaming', params: { streamId: id } });
          break;
        case 'message':
          this.emit('deepLink', { screen: 'Messaging', params: { conversationId: id } });
          break;
        case 'profile':
          this.emit('deepLink', { screen: 'Profile', params: { userId: id } });
          break;
        case 'playlist':
          this.emit('deepLink', { screen: 'Library', params: { playlistId: id } });
          break;
        case 'url':
          if (url) {
            Linking.openURL(url);
          }
          break;
        case 'screen':
          if (screen) {
            this.emit('deepLink', { screen, params: data.params });
          }
          break;
        default:
          console.log('Unknown deep link type:', type);
      }
    } catch (error) {
      console.error('Handle deep link failed:', error);
    }
  }

  private async processBackgroundNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    try {
      console.log('Processing background notification:', remoteMessage);

      // Handle background data processing
      if (remoteMessage.data?.type === 'sync') {
        // Trigger background sync
        this.emit('backgroundSync', remoteMessage.data);
      } else if (remoteMessage.data?.type === 'update') {
        // Handle content update
        this.emit('backgroundUpdate', remoteMessage.data);
      }

      // Store notification for later processing
      this.pendingNotifications.push({
        title: remoteMessage.notification?.title || 'Background Message',
        message: remoteMessage.notification?.body || 'You have a new message',
        data: remoteMessage.data,
      });

      await AsyncStorage.setItem(
        '@NotificationService:pendingNotifications',
        JSON.stringify(this.pendingNotifications)
      );
    } catch (error) {
      console.error('Process background notification failed:', error);
    }
  }

  private async saveDeviceToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('@NotificationService:deviceToken', token);
      console.log('Device token saved');
    } catch (error) {
      console.error('Save device token failed:', error);
    }
  }

  private async registerDeviceToken(token: string): Promise<void> {
    try {
      // Register token with your backend
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: Platform.OS }),
      });

      if (!response.ok) {
        throw new Error('Failed to register device token');
      }

      console.log('Device token registered with backend');
    } catch (error) {
      console.error('Register device token failed:', error);
      // Don't throw here to avoid breaking the app initialization
    }
  }

  // Getters
  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  getNotificationChannels(): NotificationChannel[] {
    return this.notificationChannels;
  }

  getPendingNotifications(): NotificationData[] {
    return this.pendingNotifications;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await this.cancelAllNotifications();
      this.removeAllListeners();
      this.isInitialized = false;
      console.log('NotificationService cleaned up');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
export { NotificationService };
