'use client';

import { useApi, ApiOptions } from './use-api';

/**
 * A safe wrapper around useApi that gracefully handles authentication errors
 * and other API issues during development by providing fallback data.
 * 
 * This is useful when APIs aren't fully implemented yet but you want to 
 * prevent runtime errors from breaking the UI.
 */

interface SafeApiOptions<T> extends ApiOptions {
  fallbackData?: T;
  enableApi?: boolean; // Allow disabling API calls entirely
  silentFallback?: boolean; // Don't log errors when using fallback
}

export function useSafeApi<T = any>(
  url: string, 
  options: SafeApiOptions<T> = {}
) {
  const {
    fallbackData,
    enableApi = true,
    silentFallback = false,
    onError,
    ...apiOptions
  } = options;

  // If API is disabled, return fallback data immediately
  if (!enableApi) {
    return {
      data: fallbackData || null,
      loading: false,
      error: null,
      execute: async () => fallbackData || null,
      reset: () => {},
    };
  }

  const apiResult = useApi<T>(url, {
    ...apiOptions,
    onError: (error) => {
      if (!silentFallback) {
        console.warn(`API call to ${url} failed, using fallback data:`, error.message);
      }
      onError?.(error);
    },
  });

  // If there's an error and we have fallback data, use it
  if (apiResult.error && fallbackData !== undefined) {
    return {
      ...apiResult,
      data: fallbackData,
      error: null, // Clear the error since we're handling it with fallback
    };
  }

  return apiResult;
}

/**
 * Hook for temporarily mocking API calls during development
 * Useful for components that need API data but the endpoints aren't ready yet
 */
export function useMockApi<T = any>(mockData: T, delay: number = 0) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(mockData), delay);
  });
}

/**
 * Configuration for enabling/disabling API calls globally
 * Useful for development environments where APIs might not be available
 */
export const ApiConfig = {
  // Set to false to disable all API calls globally during development
  enableApiCalls: true,
  
  // Default fallback behavior
  silentFallbacks: false,
  
  // Development mode detection
  isDevelopment: process.env.NODE_ENV === 'development',
};

/**
 * Helper to determine if an API endpoint should be called
 * based on configuration and endpoint readiness
 */
export function shouldCallApi(endpoint: string): boolean {
  if (!ApiConfig.enableApiCalls) return false;
  if (!ApiConfig.isDevelopment) return true;
  
  // List of endpoints that are known to be working
  const workingEndpoints = [
    '/api/auth',
    // Add other working endpoints here as they're implemented
  ];
  
  return workingEndpoints.some(working => endpoint.startsWith(working));
}