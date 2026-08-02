/**
 * Mobile API Service Layer
 * 
 * Type-safe API client matching backend routes with error handling and retry logic.
 * Requirements: 6.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Default configuration
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
};

class MobileApiService {
  private config: ApiConfig;
  private authTokens: AuthTokens | null = null;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Authentication methods
  async login(email: string, password: string): Promise<ApiResponse<{ user: any; tokens: AuthTokens }>> {
    return this.request('/api/auth/signin', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(userData: { email: string; password: string; displayName: string }): Promise<ApiResponse<{ user: any }>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async refreshToken(): Promise<ApiResponse<AuthTokens>> {
    if (!this.authTokens?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    return this.request('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: this.authTokens.refreshToken },
    });
  }

  // User methods
  async getProfile(): Promise<ApiResponse<any>> {
    return this.request('/api/user/profile');
  }

  async updateProfile(data: any): Promise<ApiResponse<any>> {
    return this.request('/api/user/profile', {
      method: 'PUT',
      body: data,
    });
  }

  // Content methods
  async getContent(params?: { page?: number; limit?: number; type?: string }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/content${query ? `?${query}` : ''}`);
  }

  async getContentById(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/content/${id}`);
  }

  async uploadContent(formData: FormData): Promise<ApiResponse<any>> {
    return this.request('/api/content/upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  }

  // Artist methods
  async getArtists(params?: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/artists${query ? `?${query}` : ''}`);
  }

  async getArtistById(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/artists/${id}`);
  }

  async subscribeToArtist(artistId: string, tierId: string): Promise<ApiResponse<any>> {
    return this.request('/api/subscriptions', {
      method: 'POST',
      body: { artistId, tierId },
    });
  }

  // Subscription methods
  async getSubscriptions(): Promise<ApiResponse<any[]>> {
    return this.request('/api/user/subscriptions');
  }

  async cancelSubscription(subscriptionId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // Payment methods
  async createPaymentIntent(amount: number, currency: string = 'USD'): Promise<ApiResponse<any>> {
    return this.request('/api/payments/create-intent', {
      method: 'POST',
      body: { amount, currency },
    });
  }

  // Messaging methods
  async getConversations(): Promise<ApiResponse<any[]>> {
    return this.request('/api/messages/conversations');
  }

  async getMessages(conversationId: string, page?: number): Promise<ApiResponse<any[]>> {
    const query = page ? `?page=${page}` : '';
    return this.request(`/api/messages/${conversationId}${query}`);
  }

  async sendMessage(recipientId: string, content: string, type: string = 'TEXT'): Promise<ApiResponse<any>> {
    return this.request('/api/messages', {
      method: 'POST',
      body: { recipientId, content, type },
    });
  }

  // Notifications methods
  async getNotifications(): Promise<ApiResponse<any[]>> {
    return this.request('/api/user/notifications');
  }

  async markNotificationRead(notificationId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/user/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  // Core request method with retry logic
  private async request(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      isFormData?: boolean;
    } = {}
  ): Promise<ApiResponse> {
    const { method = 'GET', body, headers = {}, isFormData = false } = options;
    
    let attempt = 0;
    while (attempt < this.config.retryAttempts) {
      try {
        // Prepare headers
        const requestHeaders: Record<string, string> = {
          ...headers,
        };

        if (!isFormData) {
          requestHeaders['Content-Type'] = 'application/json';
        }

        // Add auth token if available
        if (this.authTokens?.accessToken) {
          requestHeaders['Authorization'] = `Bearer ${this.authTokens.accessToken}`;
        }

        // Prepare body
        let requestBody: string | FormData | undefined;
        if (body) {
          requestBody = isFormData ? body : JSON.stringify(body);
        }

        // Make request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle token expiration
        if (response.status === 401 && this.authTokens?.refreshToken) {
          const refreshResult = await this.refreshToken();
          if (refreshResult.data) {
            this.authTokens = refreshResult.data;
            await this.saveTokens(refreshResult.data);
            // Retry with new token
            continue;
          }
        }

        // Parse response
        let data;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        return {
          data: response.ok ? data : undefined,
          error: response.ok ? undefined : data?.message || `HTTP ${response.status}`,
          status: response.status,
        };

      } catch (error) {
        attempt++;
        
        if (attempt >= this.config.retryAttempts) {
          return {
            error: error instanceof Error ? error.message : 'Network error',
            status: 0,
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
      }
    }

    return {
      error: 'Max retry attempts exceeded',
      status: 0,
    };
  }

  // Token management
  async setTokens(tokens: AuthTokens): Promise<void> {
    this.authTokens = tokens;
    await this.saveTokens(tokens);
  }

  async clearTokens(): Promise<void> {
    this.authTokens = null;
    await AsyncStorage.removeItem('auth_tokens');
  }

  async loadTokens(): Promise<AuthTokens | null> {
    try {
      const stored = await AsyncStorage.getItem('auth_tokens');
      if (stored) {
        const tokens = JSON.parse(stored);
        if (tokens.expiresAt > Date.now()) {
          this.authTokens = tokens;
          return tokens;
        }
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
    return null;
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  // Configuration
  updateConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ApiConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const apiService = new MobileApiService();
export default apiService;