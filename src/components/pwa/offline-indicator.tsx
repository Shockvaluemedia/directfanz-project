'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { usePWA, cacheUtils } from '@/hooks/use-pwa';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  Trash2,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const { isOnline } = usePWA();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [offlineActions, setOfflineActions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
    } else {
      // Hide banner after coming back online
      const timer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showOfflineBanner && isOnline) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isOnline ? "bg-green-600" : "bg-orange-600",
      className
    )}>
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="w-5 h-5" />
          ) : (
            <WifiOff className="w-5 h-5" />
          )}
          <div>
            <span className="font-medium">
              {isOnline ? "You're back online!" : "You're offline"}
            </span>
            <p className="text-sm opacity-90">
              {isOnline 
                ? "All features are now available"
                : "Some features may be limited. Cached content is still available."
              }
            </p>
          </div>
        </div>
        
        {showDetails && (
          <EnhancedButton
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            Details
          </EnhancedButton>
        )}
        
        <button
          onClick={() => setShowOfflineBanner(false)}
          className="p-1 hover:bg-white/20 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function OfflineContentBanner() {
  const { isOnline } = usePWA();
  const [offlineContent, setOfflineContent] = useState(0);

  useEffect(() => {
    // Count offline content/actions
    const countOfflineContent = async () => {
      const offlineMessages = localStorage.getItem('offline-messages');
      const offlineUploads = localStorage.getItem('offline-uploads');
      
      let count = 0;
      if (offlineMessages) count += JSON.parse(offlineMessages).length;
      if (offlineUploads) count += JSON.parse(offlineUploads).length;
      
      setOfflineContent(count);
    };

    countOfflineContent();
  }, [isOnline]);

  const syncOfflineContent = async () => {
    // Sync offline content when back online
    try {
      // Sync messages
      const offlineMessages = localStorage.getItem('offline-messages');
      if (offlineMessages) {
        const messages = JSON.parse(offlineMessages);
        // Send each message to server
        for (const message of messages) {
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
          });
        }
        localStorage.removeItem('offline-messages');
      }

      // Sync uploads
      const offlineUploads = localStorage.getItem('offline-uploads');
      if (offlineUploads) {
        const uploads = JSON.parse(offlineUploads);
        // Process each upload
        for (const upload of uploads) {
          const formData = new FormData();
          formData.append('file', upload.file);
          formData.append('metadata', JSON.stringify(upload.metadata));
          
          await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
        }
        localStorage.removeItem('offline-uploads');
      }

      setOfflineContent(0);
    } catch (error) {
      console.error('Error syncing offline content:', error);
    }
  };

  if (!isOnline || offlineContent === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">Sync offline content</h3>
            <p className="text-sm text-blue-700">
              You have {offlineContent} items waiting to sync
            </p>
          </div>
        </div>
        
        <EnhancedButton
          variant="primary"
          size="sm"
          onClick={syncOfflineContent}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Now
        </EnhancedButton>
      </div>
    </div>
  );
}

interface CacheManagerProps {
  className?: string;
}

export function CacheManager({ className }: CacheManagerProps) {
  const [cacheSize, setCacheSize] = useState<{
    usage: number;
    quota: number;
    usageDetails: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const loadCacheInfo = async () => {
    try {
      const info = await cacheUtils.getCacheSize();
      setCacheSize(info);
    } catch (error) {
      console.error('Error getting cache info:', error);
    }
  };

  const clearAllCache = async () => {
    setIsLoading(true);
    try {
      await cacheUtils.clearCache();
      await loadCacheInfo();
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadOfflineContent = async () => {
    setIsLoading(true);
    try {
      // Cache essential content for offline use
      const essentialUrls = [
        '/',
        '/messages',
        '/dashboard',
        '/streaming',
        '/upload',
      ];
      
      await cacheUtils.cacheContent('essential-pages', essentialUrls);
      await loadCacheInfo();
    } catch (error) {
      console.error('Error caching content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUsagePercentage = () => {
    if (!cacheSize) return 0;
    return Math.round((cacheSize.usage / cacheSize.quota) * 100);
  };

  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Storage & Cache
        </h3>
        <EnhancedButton
          variant="ghost"
          size="sm"
          onClick={loadCacheInfo}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </EnhancedButton>
      </div>

      {cacheSize && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Storage Used</span>
              <span className="font-medium">
                {formatBytes(cacheSize.usage)} of {formatBytes(cacheSize.quota)} ({getUsagePercentage()}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getUsagePercentage()}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Cache</p>
              <p className="font-medium">
                {formatBytes(cacheSize.usageDetails.caches || 0)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">IndexedDB</p>
              <p className="font-medium">
                {formatBytes(cacheSize.usageDetails.indexedDB || 0)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <EnhancedButton
              variant="primary"
              size="sm"
              onClick={downloadOfflineContent}
              disabled={isLoading}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download for Offline
            </EnhancedButton>
            <EnhancedButton
              variant="destructive"
              size="sm"
              onClick={clearAllCache}
              disabled={isLoading}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cache
            </EnhancedButton>
          </div>
        </div>
      )}
    </div>
  );
}

// Background sync status indicator
export function BackgroundSyncStatus() {
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  useEffect(() => {
    // Listen for background sync events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_STATUS') {
          setSyncStatus(event.data.status);
          setPendingSyncs(event.data.pendingCount || 0);
        }
      });
    }

    // Check for pending syncs
    const checkPendingSyncs = () => {
      let count = 0;
      if (localStorage.getItem('offline-messages')) {
        count += JSON.parse(localStorage.getItem('offline-messages') || '[]').length;
      }
      if (localStorage.getItem('offline-uploads')) {
        count += JSON.parse(localStorage.getItem('offline-uploads') || '[]').length;
      }
      setPendingSyncs(count);
    };

    checkPendingSyncs();
    const interval = setInterval(checkPendingSyncs, 5000);
    return () => clearInterval(interval);
  }, []);

  if (pendingSyncs === 0 && syncStatus === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-6 bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-2 z-40">
      {syncStatus === 'syncing' ? (
        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
      ) : syncStatus === 'error' ? (
        <AlertCircle className="w-4 h-4 text-red-600" />
      ) : (
        <CheckCircle className="w-4 h-4 text-green-600" />
      )}
      
      <span className="text-sm font-medium">
        {syncStatus === 'syncing' ? 'Syncing...' :
         syncStatus === 'error' ? 'Sync failed' :
         pendingSyncs > 0 ? `${pendingSyncs} pending` : 'All synced'}
      </span>
    </div>
  );
}