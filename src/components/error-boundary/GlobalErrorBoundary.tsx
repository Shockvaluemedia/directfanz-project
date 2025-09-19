'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global Error Boundary caught an error:', error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // This would be where you'd send to Sentry, LogRocket, etc.
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
          <div className='max-w-md w-full space-y-8 text-center'>
            <div>
              <AlertTriangle className='mx-auto h-16 w-16 text-red-500' />
              <h2 className='mt-6 text-3xl font-extrabold text-gray-900'>Something went wrong</h2>
              <p className='mt-2 text-sm text-gray-600'>
                We apologize for the inconvenience. The page encountered an unexpected error.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className='mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-left'>
                <h3 className='text-lg font-medium text-red-800 mb-2'>
                  Error Details (Development Mode)
                </h3>
                <pre className='text-xs text-red-700 overflow-x-auto whitespace-pre-wrap'>
                  {this.state.error.message}
                  {this.state.error.stack && `\n\nStack:\n${this.state.error.stack}`}
                  {this.state.errorInfo?.componentStack &&
                    `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
                </pre>
              </div>
            )}

            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <button
                onClick={this.handleRetry}
                className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              >
                <RefreshCw className='w-4 h-4 mr-2' />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className='inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              >
                <RefreshCw className='w-4 h-4 mr-2' />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className='inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              >
                <Home className='w-4 h-4 mr-2' />
                Go Home
              </button>
            </div>

            <p className='mt-4 text-xs text-gray-500'>
              If this problem persists, please contact support with the error details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
