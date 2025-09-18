'use client';

import React from 'react';
import { ConnectionStatus } from '@/types/websocket';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  error?: string | null;
  className?: string;
}

export function ConnectionIndicator({ status, error, className = '' }: ConnectionIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return 'bg-green-500';
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.RECONNECTING:
        return 'bg-yellow-500 animate-pulse';
      case ConnectionStatus.ERROR:
      case ConnectionStatus.DISCONNECTED:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return 'Connected';
      case ConnectionStatus.CONNECTING:
        return 'Connecting...';
      case ConnectionStatus.RECONNECTING:
        return 'Reconnecting...';
      case ConnectionStatus.ERROR:
        return error || 'Connection Error';
      case ConnectionStatus.DISCONNECTED:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.RECONNECTING:
        return (
          <svg className="w-4 h-4 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case ConnectionStatus.ERROR:
      case ConnectionStatus.DISCONNECTED:
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status indicator dot */}
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      
      {/* Status icon and text (for mobile-friendly display) */}
      <div className="hidden sm:flex items-center space-x-1">
        {getStatusIcon()}
        <span className={`text-xs font-medium ${
          status === ConnectionStatus.CONNECTED 
            ? 'text-green-600' 
            : status === ConnectionStatus.ERROR || status === ConnectionStatus.DISCONNECTED
            ? 'text-red-600'
            : 'text-yellow-600'
        }`}>
          {getStatusText()}
        </span>
      </div>
      
      {/* Tooltip for mobile */}
      <div className="sm:hidden" title={getStatusText()}>
        {getStatusIcon()}
      </div>
    </div>
  );
}