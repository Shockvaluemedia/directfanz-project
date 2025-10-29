import { useState, useEffect } from 'react';

export type NotificationPermission = 'default' | 'denied' | 'granted';

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: NotificationAction[];
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const checkSupport = () => {
      setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
      setPermission(Notification.permission as NotificationPermission);
    };

    // Get service worker registration
    const getRegistration = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          setRegistration(reg);
          
          // Get existing subscription
          const sub = await reg.pushManager.getSubscription();
          setSubscription(sub);
        } catch (error) {
          console.error('Error getting service worker registration:', error);
        }
      }
    };

    checkSupport();
    getRegistration();
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result as NotificationPermission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  };

  const subscribe = async (vapidPublicKey: string): Promise<PushSubscription | null> => {
    if (!registration || permission !== 'granted') return null;

    try {
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(sub);
      
      // Send subscription to server
      await sendSubscriptionToServer(sub);
      
      return sub;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!subscription) return false;

    try {
      const result = await subscription.unsubscribe();
      if (result) {
        setSubscription(null);
        // Remove subscription from server
        await removeSubscriptionFromServer(subscription);
      }
      return result;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  };

  const showNotification = async (options: PushNotificationOptions): Promise<void> => {
    if (!registration || permission !== 'granted') return;

    try {
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icons/icon-192x192.png',
        badge: options.badge || '/icons/badge-72x72.png',
        image: options.image,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: options.vibrate || [200, 100, 200],
        actions: options.actions || [],
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  return {
    permission,
    isSupported,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  };
}

// Utility functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch (error) {
    console.error('Error sending subscription to server:', error);
  }
}

async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });
  } catch (error) {
    console.error('Error removing subscription from server:', error);
  }
}

// Notification templates
export const notificationTemplates = {
  newMessage: (sender: string, preview: string): PushNotificationOptions => ({
    title: `New message from ${sender}`,
    body: preview,
    icon: '/icons/notification-message.png',
    tag: 'message',
    requireInteraction: true,
    actions: [
      {
        action: 'reply',
        title: 'Reply',
        icon: '/icons/action-reply.png'
      },
      {
        action: 'view',
        title: 'View',
        icon: '/icons/action-view.png'
      }
    ]
  }),

  liveStream: (streamerName: string, title: string): PushNotificationOptions => ({
    title: `${streamerName} is now live!`,
    body: title,
    icon: '/icons/notification-live.png',
    tag: 'live-stream',
    requireInteraction: true,
    actions: [
      {
        action: 'watch',
        title: 'Watch Now',
        icon: '/icons/action-play.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/action-dismiss.png'
      }
    ]
  }),

  newContent: (creatorName: string, contentTitle: string): PushNotificationOptions => ({
    title: `New content from ${creatorName}`,
    body: contentTitle,
    icon: '/icons/notification-content.png',
    tag: 'new-content',
    actions: [
      {
        action: 'view',
        title: 'View Content',
        icon: '/icons/action-view.png'
      }
    ]
  }),

  tip: (amount: number, sender: string): PushNotificationOptions => ({
    title: 'New tip received!',
    body: `${sender} sent you $${amount}`,
    icon: '/icons/notification-tip.png',
    tag: 'tip',
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'thank',
        title: 'Say Thanks',
        icon: '/icons/action-heart.png'
      }
    ]
  }),

  subscription: (subscriberName: string): PushNotificationOptions => ({
    title: 'New subscriber!',
    body: `${subscriberName} just subscribed to your content`,
    icon: '/icons/notification-subscriber.png',
    tag: 'subscription',
    vibrate: [300, 100, 300],
    actions: [
      {
        action: 'greet',
        title: 'Send Welcome',
        icon: '/icons/action-message.png'
      }
    ]
  }),

  reminder: (title: string, message: string): PushNotificationOptions => ({
    title,
    body: message,
    icon: '/icons/notification-reminder.png',
    tag: 'reminder',
    requireInteraction: true,
  }),
};