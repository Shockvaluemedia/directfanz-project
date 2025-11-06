'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from '@/components/ui/enhanced-card';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { usePWA, useServiceWorker } from '@/hooks/use-pwa';
import { usePushNotifications, notificationTemplates } from '@/hooks/use-push-notifications';
import {
  Smartphone,
  Bell,
  Download,
  RefreshCw,
  Settings,
  Shield,
  Zap,
  HardDrive,
  Wifi,
  Monitor,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InstallPrompt, FloatingInstallButton } from './install-prompt';
import { CacheManager, BackgroundSyncStatus } from './offline-indicator';

interface PWASettingsProps {
  className?: string;
}

export function PWASettings({ className }: PWASettingsProps) {
  const { isInstallable, isInstalled, isOnline, installApp, shareContent } = usePWA();
  const { registration, isSupported, isRegistered, updateServiceWorker } = useServiceWorker();
  const {
    permission,
    isSupported: notificationsSupported,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification
  } = usePushNotifications();

  const [settings, setSettings] = useState({
    notifications: {
      messages: true,
      liveStreams: true,
      newContent: true,
      tips: true,
      subscriptions: true,
      marketing: false
    },
    offline: {
      downloadContent: true,
      backgroundSync: true,
      cacheImages: true,
      cacheVideos: false
    },
    appearance: {
      theme: 'auto',
      density: 'comfortable'
    }
  });

  const [testNotification, setTestNotification] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pwa-settings');
    if (savedSettings) {
      setSettings({ ...settings, ...JSON.parse(savedSettings) });
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('pwa-settings', JSON.stringify(newSettings));
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const perm = await requestPermission();
      if (perm === 'granted') {
        // Subscribe with VAPID key (you'd get this from your server)
        await subscribe('YOUR_VAPID_PUBLIC_KEY');
      }
    } else {
      await unsubscribe();
    }
  };

  const sendTestNotification = async () => {
    setTestNotification(true);
    try {
      await showNotification({
        title: 'DirectFanZ Test Notification',
        body: 'This is a test notification to verify your settings work correctly.',
        icon: '/icons/icon-192x192.png',
        tag: 'test',
        requireInteraction: false
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    } finally {
      setTestNotification(false);
    }
  };

  const getInstallationStatus = () => {
    if (isInstalled) {
      return { status: 'installed', message: 'App is installed', color: 'text-green-600' };
    } else if (isInstallable) {
      return { status: 'installable', message: 'Ready to install', color: 'text-blue-600' };
    } else {
      return { status: 'not-available', message: 'Installation not available', color: 'text-gray-600' };
    }
  };

  const getServiceWorkerStatus = () => {
    if (!isSupported) {
      return { status: 'not-supported', message: 'Not supported', color: 'text-gray-600' };
    } else if (isRegistered) {
      return { status: 'active', message: 'Active', color: 'text-green-600' };
    } else {
      return { status: 'inactive', message: 'Inactive', color: 'text-red-600' };
    }
  };

  const getNotificationStatus = () => {
    if (!notificationsSupported) {
      return { status: 'not-supported', message: 'Not supported', color: 'text-gray-600' };
    } else if (permission === 'granted' && subscription) {
      return { status: 'enabled', message: 'Enabled', color: 'text-green-600' };
    } else if (permission === 'denied') {
      return { status: 'blocked', message: 'Blocked', color: 'text-red-600' };
    } else {
      return { status: 'disabled', message: 'Disabled', color: 'text-orange-600' };
    }
  };

  const installationInfo = getInstallationStatus();
  const serviceWorkerInfo = getServiceWorkerStatus();
  const notificationInfo = getNotificationStatus();

  return (
    <div className={cn("space-y-6", className)}>
      {/* PWA Status Overview */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            App Status
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Installation</span>
                {installationInfo.status === 'installed' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : installationInfo.status === 'installable' ? (
                  <Download className="w-4 h-4 text-blue-600" />
                ) : (
                  <X className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <p className={cn("text-sm font-medium", installationInfo.color)}>
                {installationInfo.message}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Service Worker</span>
                {serviceWorkerInfo.status === 'active' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : serviceWorkerInfo.status === 'inactive' ? (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <X className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <p className={cn("text-sm font-medium", serviceWorkerInfo.color)}>
                {serviceWorkerInfo.message}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Notifications</span>
                {notificationInfo.status === 'enabled' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : notificationInfo.status === 'blocked' ? (
                  <X className="w-4 h-4 text-red-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                )}
              </div>
              <p className={cn("text-sm font-medium", notificationInfo.color)}>
                {notificationInfo.message}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            {isInstallable && !isInstalled && (
              <EnhancedButton
                variant="primary"
                size="sm"
                onClick={installApp}
              >
                <Download className="w-4 h-4 mr-2" />
                Install App
              </EnhancedButton>
            )}

            {registration && registration.waiting && (
              <EnhancedButton
                variant="secondary"
                size="sm"
                onClick={updateServiceWorker}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Available
              </EnhancedButton>
            )}

            {notificationsSupported && permission !== 'granted' && (
              <EnhancedButton
                variant="secondary"
                size="sm"
                onClick={() => handleNotificationToggle(true)}
              >
                <Bell className="w-4 h-4 mr-2" />
                Enable Notifications
              </EnhancedButton>
            )}
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Notification Settings */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Notification Preferences
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          {notificationsSupported ? (
            <div className="space-y-4">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </label>
                    <p className="text-xs text-gray-500">
                      {key === 'messages' && 'New direct messages'}
                      {key === 'liveStreams' && 'When creators go live'}
                      {key === 'newContent' && 'New content from subscribed creators'}
                      {key === 'tips' && 'When you receive tips'}
                      {key === 'subscriptions' && 'New subscribers'}
                      {key === 'marketing' && 'Platform updates and promotions'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => {
                      const newSettings = {
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          [key]: e.target.checked
                        }
                      };
                      saveSettings(newSettings);
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    disabled={permission !== 'granted'}
                  />
                </div>
              ))}

              {permission === 'granted' && (
                <div className="pt-4 border-t border-gray-200">
                  <EnhancedButton
                    variant="ghost"
                    size="sm"
                    onClick={sendTestNotification}
                    disabled={testNotification}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    {testNotification ? 'Sending...' : 'Send Test Notification'}
                  </EnhancedButton>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Push notifications are not supported in this browser</p>
            </div>
          )}
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Offline & Caching Settings */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-indigo-600" />
            Offline & Caching
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="space-y-4">
            {Object.entries(settings.offline).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </label>
                  <p className="text-xs text-gray-500">
                    {key === 'downloadContent' && 'Download pages for offline viewing'}
                    {key === 'backgroundSync' && 'Sync data when connection is restored'}
                    {key === 'cacheImages' && 'Cache images for faster loading'}
                    {key === 'cacheVideos' && 'Cache videos (uses more storage)'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => {
                    const newSettings = {
                      ...settings,
                      offline: {
                        ...settings.offline,
                        [key]: e.target.checked
                      }
                    };
                    saveSettings(newSettings);
                  }}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Cache Management */}
      <CacheManager />

      {/* App Information */}
      <EnhancedCard variant="elevated">
        <EnhancedCardHeader>
          <EnhancedCardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            App Information
          </EnhancedCardTitle>
        </EnhancedCardHeader>
        <EnhancedCardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Version:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Platform:</span>
              <span className="font-medium">
                {typeof window !== 'undefined' ? window.navigator.platform : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Connection:</span>
              <span className={cn(
                "font-medium",
                isOnline ? "text-green-600" : "text-red-600"
              )}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <EnhancedButton
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh App
            </EnhancedButton>
          </div>
        </EnhancedCardContent>
      </EnhancedCard>

      {/* Background components */}
      <BackgroundSyncStatus />
      {!isInstalled && <FloatingInstallButton />}
    </div>
  );
}

// PWA Features showcase for onboarding
export function PWAFeatures() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Lightning Fast</h3>
        <p className="text-gray-600 text-sm">
          Native-like performance with instant loading and smooth animations
        </p>
      </div>

      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Wifi className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Offline Ready</h3>
        <p className="text-gray-600 text-sm">
          Access your content even without an internet connection
        </p>
      </div>

      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Bell className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Push Notifications</h3>
        <p className="text-gray-600 text-sm">
          Stay updated with instant notifications for messages and live streams
        </p>
      </div>

      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Monitor className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Desktop App</h3>
        <p className="text-gray-600 text-sm">
          Install on your desktop for a full app experience
        </p>
      </div>

      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <HardDrive className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Smart Caching</h3>
        <p className="text-gray-600 text-sm">
          Intelligent content caching for faster access and reduced data usage
        </p>
      </div>

      <div className="text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full mx-auto mb-4 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Background Sync</h3>
        <p className="text-gray-600 text-sm">
          Automatic data synchronization when you come back online
        </p>
      </div>
    </div>
  );
}