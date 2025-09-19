'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Global request cache to prevent duplicate requests across components
const requestCache = new Map<string, Promise<any>>();

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface ApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useApi<T = any>(url: string, options: RequestInit & ApiOptions = {}) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const requestRef = useRef<Promise<any> | null>(null);
  const mountedRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { immediate = false } = options;

  const execute = useCallback(
    async (overrideOptions?: RequestInit) => {
      const requestKey = `${url}:${JSON.stringify(overrideOptions || {})}`;

      // Check global cache first
      if (requestCache.has(requestKey)) {
        const cachedRequest = requestCache.get(requestKey)!;
        requestRef.current = cachedRequest;
        return cachedRequest;
      }

      // Prevent duplicate requests from same component
      if (requestRef.current) {
        return requestRef.current;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      const request = (async () => {
        try {
          const { onSuccess, onError, ...fetchOptions } = optionsRef.current;

          const response = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              ...fetchOptions.headers,
            },
            ...fetchOptions,
            ...overrideOptions,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage =
              errorData.error ||
              errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
          }

          const data = await response.json();

          // Only update state if component is still mounted
          if (mountedRef.current) {
            setState(prev => ({ ...prev, data, loading: false }));
            onSuccess?.(data);
          }
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An error occurred';
          if (mountedRef.current) {
            const { onError } = optionsRef.current;
            setState(prev => ({ ...prev, error: errorMessage, loading: false }));
            onError?.(error instanceof Error ? error : new Error(errorMessage));
          }
          throw error;
        } finally {
          requestRef.current = null;
          // Clean up global cache after a short delay
          setTimeout(() => {
            requestCache.delete(requestKey);
          }, 100);
        }
      })();

      requestRef.current = request;
      requestCache.set(requestKey, request);
      return request;
    },
    [url]
  );

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, url]); // Remove execute from dependencies to prevent loops

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
    requestRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current = null;
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export function useApiMutation<T = any, V = any>(
  url: string,
  options: RequestInit & ApiOptions = {}
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { onSuccess, onError, ...fetchOptions } = options;

  const mutate = useCallback(
    async (variables: V, overrideOptions?: RequestInit) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
          body: JSON.stringify(variables),
          ...fetchOptions,
          ...overrideOptions,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setState(prev => ({ ...prev, data, loading: false }));
        onSuccess?.(data);
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setState(prev => ({ ...prev, error: errorMessage, loading: false }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      }
    },
    [url, fetchOptions, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
