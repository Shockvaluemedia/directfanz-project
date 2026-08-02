/**
 * Mobile Authentication Service
 * 
 * NextAuth.js token-based authentication with secure token storage
 * and session management for React Native.
 * Requirements: 6.2, 6.3
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, type AuthTokens } from './api';

// Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatar?: string;
  emailVerified?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: AuthTokens | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
}

// Constants
const KEYCHAIN_SERVICE = 'DirectFanzAuth';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

class MobileAuthService {
  private authState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    tokens: null,
  };

  private listeners: Array<(state: AuthState) => void> = [];
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  // Initialize authentication state
  private async initialize(): Promise<void> {
    try {
      // Load tokens from secure storage
      const tokens = await this.loadSecureTokens();
      if (tokens) {
        // Validate tokens and load user data
        const user = await this.loadUserData();
        if (user && tokens.expiresAt > Date.now()) {
          this.authState = {
            user,
            isAuthenticated: true,
            isLoading: false,
            tokens,
          };
          
          // Set tokens in API service
          await apiService.setTokens(tokens);
          
          // Schedule token refresh
          this.scheduleTokenRefresh(tokens.expiresAt);
        } else {
          // Tokens expired or invalid, try refresh
          await this.attemptTokenRefresh(tokens);
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      this.authState.isLoading = false;
      this.notifyListeners();
    }
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const response = await apiService.login(credentials.email, credentials.password);
      
      if (response.error) {
        this.updateState({ isLoading: false });
        return { success: false, error: response.error };
      }

      const { user, tokens } = response.data;
      
      // Store tokens securely
      await this.storeSecureTokens(tokens);
      await this.storeUserData(user);
      
      // Update state
      this.updateState({
        user,
        isAuthenticated: true,
        isLoading: false,
        tokens,
      });

      // Set tokens in API service
      await apiService.setTokens(tokens);
      
      // Schedule token refresh
      this.scheduleTokenRefresh(tokens.expiresAt);

      return { success: true };
    } catch (error) {
      this.updateState({ isLoading: false });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }

  async register(data: RegisterData): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const response = await apiService.register(data);
      
      if (response.error) {
        this.updateState({ isLoading: false });
        return { success: false, error: response.error };
      }

      // After registration, user needs to login
      this.updateState({ isLoading: false });
      return { success: true };
    } catch (error) {
      this.updateState({ isLoading: false });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  }

  async logout(): Promise<void> {
    try {
      // Clear secure storage
      await this.clearSecureTokens();
      await this.clearUserData();
      
      // Clear API service tokens
      await apiService.clearTokens();
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      // Update state
      this.updateState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        tokens: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Token management
  private async attemptTokenRefresh(tokens: AuthTokens): Promise<void> {
    try {
      if (!tokens.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiService.refreshToken();
      
      if (response.error) {
        throw new Error(response.error);
      }

      const newTokens = response.data;
      const user = await this.loadUserData();
      
      if (user) {
        // Store new tokens
        await this.storeSecureTokens(newTokens);
        
        // Update state
        this.updateState({
          user,
          isAuthenticated: true,
          isLoading: false,
          tokens: newTokens,
        });

        // Set tokens in API service
        await apiService.setTokens(newTokens);
        
        // Schedule next refresh
        this.scheduleTokenRefresh(newTokens.expiresAt);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
    }
  }

  private scheduleTokenRefresh(expiresAt: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh 5 minutes before expiration
    const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        if (this.authState.tokens) {
          this.attemptTokenRefresh(this.authState.tokens);
        }
      }, refreshTime);
    }
  }

  // Secure storage methods
  private async storeSecureTokens(tokens: AuthTokens): Promise<void> {
    try {
      // Store refresh token in Keychain (most secure)
      await Keychain.setInternetCredentials(
        KEYCHAIN_SERVICE,
        REFRESH_TOKEN_KEY,
        tokens.refreshToken
      );

      // Store access token and expiry in AsyncStorage (less sensitive)
      await AsyncStorage.setItem('access_token', tokens.accessToken);
      await AsyncStorage.setItem('token_expires_at', tokens.expiresAt.toString());
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw error;
    }
  }

  private async loadSecureTokens(): Promise<AuthTokens | null> {
    try {
      // Load refresh token from Keychain
      const credentials = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
      if (!credentials || credentials.username !== REFRESH_TOKEN_KEY) {
        return null;
      }

      // Load access token from AsyncStorage
      const accessToken = await AsyncStorage.getItem('access_token');
      const expiresAtStr = await AsyncStorage.getItem('token_expires_at');
      
      if (!accessToken || !expiresAtStr) {
        return null;
      }

      return {
        accessToken,
        refreshToken: credentials.password,
        expiresAt: parseInt(expiresAtStr, 10),
      };
    } catch (error) {
      console.error('Failed to load tokens:', error);
      return null;
    }
  }

  private async clearSecureTokens(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(KEYCHAIN_SERVICE);
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('token_expires_at');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  // User data storage
  private async storeUserData(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  }

  private async loadUserData(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to load user data:', error);
      return null;
    }
  }

  private async clearUserData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }

  // State management
  private updateState(updates: Partial<AuthState>): void {
    this.authState = { ...this.authState, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  // Public API
  getState(): AuthState {
    return { ...this.authState };
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async refreshUserProfile(): Promise<void> {
    if (!this.authState.isAuthenticated) return;

    try {
      const response = await apiService.getProfile();
      if (response.data) {
        await this.storeUserData(response.data);
        this.updateState({ user: response.data });
      }
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  }

  // Utility methods
  isTokenExpired(): boolean {
    return !this.authState.tokens || this.authState.tokens.expiresAt <= Date.now();
  }

  getAccessToken(): string | null {
    return this.authState.tokens?.accessToken || null;
  }

  getCurrentUser(): User | null {
    return this.authState.user;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !this.isTokenExpired();
  }
}

// Export singleton instance
export const authService = new MobileAuthService();
export default authService;