"use client"

import { useState, useEffect, useCallback } from 'react'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface ApiOptions {
  immediate?: boolean
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useApi<T = any>(
  url: string,
  options: RequestInit & ApiOptions = {}
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null
  })

  const { immediate = false, onSuccess, onError, ...fetchOptions } = options

  const execute = useCallback(async (overrideOptions?: RequestInit) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers
        },
        ...fetchOptions,
        ...overrideOptions
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setState(prev => ({ ...prev, data, loading: false }))
      onSuccess?.(data)
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setState(prev => ({ ...prev, error: errorMessage, loading: false }))
      onError?.(error instanceof Error ? error : new Error(errorMessage))
      throw error
    }
  }, [url, fetchOptions, onSuccess, onError])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, execute])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null
    })
  }, [])

  return {
    ...state,
    execute,
    reset
  }
}

export function useApiMutation<T = any, V = any>(
  url: string,
  options: RequestInit & ApiOptions = {}
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null
  })

  const { onSuccess, onError, ...fetchOptions } = options

  const mutate = useCallback(async (variables: V, overrideOptions?: RequestInit) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers
        },
        body: JSON.stringify(variables),
        ...fetchOptions,
        ...overrideOptions
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setState(prev => ({ ...prev, data, loading: false }))
      onSuccess?.(data)
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setState(prev => ({ ...prev, error: errorMessage, loading: false }))
      onError?.(error instanceof Error ? error : new Error(errorMessage))
      throw error
    }
  }, [url, fetchOptions, onSuccess, onError])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null
    })
  }, [])

  return {
    ...state,
    mutate,
    reset
  }
}