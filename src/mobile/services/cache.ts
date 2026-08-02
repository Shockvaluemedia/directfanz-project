/**
 * Mobile Offline-First Data Caching Service
 * 
 * AsyncStorage-based content caching with action queue for offline operations
 * and sync mechanism for reconnection.
 * Requirements: 6.4, 6.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/lib/commonjs';
import { apiService } from './api';

// Types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
}

export interface OfflineAction {
  id: string;
  type: string;
  endpoint: string;
  method: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncAt: number;
  errors: string[];
}

// Constants
const CACHE_PREFIX = 'cache_';
const QUEUE_KEY = 'offline_queue';
const SYNC_STATUS_KEY = 'sync_status';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

class MobileCacheService {
  private syncStatus: SyncStatus = {
    isOnline: true,
    isSyncing: false,
    pendingActions: 0,
    lastSyncAt: 0,
    errors: [],
  };

  private listeners: Array<(status: SyncStatus) => void> = [];
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load sync status
    await this.loadSyncStatus();
    
    // Setup network monitoring
    NetInfo.addEventListener(state => {
      const wasOnline = this.syncStatus.isOnline;
      this.syncStatus.isOnline = state.isConnected ?? false;
      
      if (!wasOnline && this.syncStatus.isOnline) {
        // Came back online, trigger sync
        this.syncOfflineActions();
      }
      
      this.notifyListeners();
    });

    // Start periodic sync
    this.startPeriodicSync();
  }

  // Cache management
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check if expired
      if (entry.expiresAt < Date.now()) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
        version: 1,
      };
      
      const cacheKey = CACHE_PREFIX + key;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // Check cache size and cleanup if needed
      await this.cleanupCache();
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const cacheKey = CACHE_PREFIX + key;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Offline action queue
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const offlineAction: OfflineAction = {
        ...action,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const queue = await this.getOfflineQueue();
      queue.push(offlineAction);
      
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      
      this.syncStatus.pendingActions = queue.length;
      this.notifyListeners();

      // Try to sync immediately if online
      if (this.syncStatus.isOnline) {
        this.syncOfflineActions();
      }
    } catch (error) {
      console.error('Queue action error:', error);
    }
  }

  private async getOfflineQueue(): Promise<OfflineAction[]> {
    try {
      const queue = await AsyncStorage.getItem(QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Get queue error:', error);
      return [];
    }
  }

  private async saveOfflineQueue(queue: OfflineAction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      this.syncStatus.pendingActions = queue.length;
    } catch (error) {
      console.error('Save queue error:', error);
    }
  }

  // Sync mechanism
  async syncOfflineActions(): Promise<void> {
    if (this.syncStatus.isSyncing || !this.syncStatus.isOnline) {
      return;
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.errors = [];
    this.notifyListeners();

    try {
      const queue = await this.getOfflineQueue();
      const successfulActions: string[] = [];

      for (const action of queue) {
        try {
          await this.executeAction(action);
          successfulActions.push(action.id);
        } catch (error) {
          action.retryCount++;
          
          if (action.retryCount >= action.maxRetries) {
            // Max retries reached, remove from queue
            successfulActions.push(action.id);
            this.syncStatus.errors.push(`Action ${action.type} failed after ${action.maxRetries} retries`);
          }
          
          console.error(`Action ${action.id} failed:`, error);
        }
      }

      // Remove successful actions from queue
      const remainingQueue = queue.filter(action => !successfulActions.includes(action.id));
      await this.saveOfflineQueue(remainingQueue);

      this.syncStatus.lastSyncAt = Date.now();
    } catch (error) {
      console.error('Sync error:', error);
      this.syncStatus.errors.push('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      this.syncStatus.isSyncing = false;
      await this.saveSyncStatus();
      this.notifyListeners();
    }
  }

  private async executeAction(action: OfflineAction): Promise<void> {
    const { endpoint, method, data } = action;
    
    const response = await fetch(`${apiService.getConfig().baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // Content-specific caching methods
  async getCachedContent(params?: { page?: number; limit?: number; type?: string }): Promise<any[] | null> {
    const key = `content_${JSON.stringify(params || {})}`;
    return this.get(key);
  }

  async setCachedContent(content: any[], params?: { page?: number; limit?: number; type?: string }): Promise<void> {
    const key = `content_${JSON.stringify(params || {})}`;
    await this.set(key, content, 10 * 60 * 1000); // 10 minutes TTL
  }

  async getCachedArtists(params?: { page?: number; limit?: number }): Promise<any[] | null> {
    const key = `artists_${JSON.stringify(params || {})}`;
    return this.get(key);
  }

  async setCachedArtists(artists: any[], params?: { page?: number; limit?: number }): Promise<void> {
    const key = `artists_${JSON.stringify(params || {})}`;
    await this.set(key, artists, 15 * 60 * 1000); // 15 minutes TTL
  }

  async getCachedProfile(): Promise<any | null> {
    return this.get('user_profile');
  }

  async setCachedProfile(profile: any): Promise<void> {
    await this.set('user_profile', profile, 30 * 60 * 1000); // 30 minutes TTL
  }

  // Offline-first API methods
  async getContentOfflineFirst(params?: { page?: number; limit?: number; type?: string }): Promise<any[]> {
    // Try cache first
    const cached = await this.getCachedContent(params);
    if (cached) {
      // Return cached data immediately
      setTimeout(() => {
        // Fetch fresh data in background if online
        if (this.syncStatus.isOnline) {
          this.fetchAndCacheContent(params);
        }
      }, 0);
      
      return cached;
    }

    // No cache, try network
    if (this.syncStatus.isOnline) {
      return this.fetchAndCacheContent(params);
    }

    // Offline and no cache
    return [];
  }

  private async fetchAndCacheContent(params?: { page?: number; limit?: number; type?: string }): Promise<any[]> {
    try {
      const response = await apiService.getContent(params);
      if (response.data) {
        await this.setCachedContent(response.data, params);
        return response.data;
      }
    } catch (error) {
      console.error('Fetch content error:', error);
    }
    return [];
  }

  // Cache maintenance
  private async cleanupCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      // Get cache size
      let totalSize = 0;
      const entries: Array<{ key: string; size: number; timestamp: number }> = [];
      
      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const size = new Blob([value]).size;
          totalSize += size;
          
          try {
            const entry: CacheEntry = JSON.parse(value);
            entries.push({ key, size, timestamp: entry.timestamp });
          } catch {
            // Invalid entry, mark for deletion
            entries.push({ key, size, timestamp: 0 });
          }
        }
      }

      // If over limit, remove oldest entries
      if (totalSize > MAX_CACHE_SIZE) {
        entries.sort((a, b) => a.timestamp - b.timestamp);
        
        let removedSize = 0;
        const keysToRemove: string[] = [];
        
        for (const entry of entries) {
          keysToRemove.push(entry.key);
          removedSize += entry.size;
          
          if (totalSize - removedSize <= MAX_CACHE_SIZE * 0.8) {
            break;
          }
        }
        
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Sync status management
  private async loadSyncStatus(): Promise<void> {
    try {
      const status = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      if (status) {
        const parsed = JSON.parse(status);
        this.syncStatus = { ...this.syncStatus, ...parsed };
      }
    } catch (error) {
      console.error('Load sync status error:', error);
    }
  }

  private async saveSyncStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(this.syncStatus));
    } catch (error) {
      console.error('Save sync status error:', error);
    }
  }

  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      if (this.syncStatus.isOnline && this.syncStatus.pendingActions > 0) {
        this.syncOfflineActions();
      }
    }, 30000); // Sync every 30 seconds
  }

  // Public API
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.syncStatus));
  }

  async forcSync(): Promise<void> {
    await this.syncOfflineActions();
  }

  // Cleanup
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

// Export singleton instance
export const cacheService = new MobileCacheService();
export default cacheService;