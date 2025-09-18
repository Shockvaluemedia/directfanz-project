'use client';

import React from 'react';
import { format } from 'date-fns';
import { Message } from '@/types/websocket';
import { MessageStatusIndicator } from './MessageStatusIndicator';

interface MessageBubbleProps {
  message: Message;
  isFromCurrentUser: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isGrouped?: boolean;
  className?: string;
}

export function MessageBubble({
  message,
  isFromCurrentUser,
  showAvatar = true,
  showTimestamp = true,
  isGrouped = false,
  className = ''
}: MessageBubbleProps) {
  const messageTime = new Date(message.createdAt);

  const getBubbleStyles = () => {
    const baseStyles = 'max-w-xs lg:max-w-md px-4 py-2 rounded-2xl break-words';
    
    if (isFromCurrentUser) {
      return `${baseStyles} bg-blue-500 text-white ml-auto`;
    } else {
      return `${baseStyles} bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white`;
    }
  };

  const getContainerStyles = () => {
    const baseStyles = 'flex items-end space-x-2';
    const marginStyles = isGrouped ? 'mt-1' : 'mt-2';
    
    if (isFromCurrentUser) {
      return `${baseStyles} ${marginStyles} justify-end`;
    } else {
      return `${baseStyles} ${marginStyles}`;
    }
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'IMAGE':
        return (
          <div className="space-y-2">
            {message.attachmentUrl && (
              <img
                src={message.attachmentUrl}
                alt="Shared image"
                className="rounded-lg max-w-full h-auto"
                loading="lazy"
              />
            )}
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );
      
      case 'AUDIO':
        return (
          <div className="space-y-2">
            {message.attachmentUrl && (
              <audio
                controls
                className="w-full max-w-xs"
                preload="metadata"
              >
                <source src={message.attachmentUrl} />
                Your browser does not support the audio element.
              </audio>
            )}
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );
      
      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    }
  };

  return (
    <div className={`${getContainerStyles()} ${className}`}>
      {/* Avatar (for messages from others) */}
      {!isFromCurrentUser && (
        <div className="flex-shrink-0">
          {showAvatar ? (
            <img
              src={message.sender?.avatar || '/default-avatar.png'}
              alt={message.sender?.displayName || 'User'}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8" /> /* Spacer for alignment */
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className="flex flex-col space-y-1 max-w-full">
        {/* Sender name (for grouped messages from others) */}
        {!isFromCurrentUser && !isGrouped && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
            {message.sender?.displayName || 'Unknown User'}
          </span>
        )}

        {/* Message content */}
        <div className={getBubbleStyles()}>
          {renderMessageContent()}
        </div>

        {/* Timestamp and status */}
        {showTimestamp && (
          <div className={`flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 ${
            isFromCurrentUser ? 'justify-end' : 'justify-start ml-1'
          }`}>
            <span>{format(messageTime, 'h:mm a')}</span>
            
            {/* Message status for current user's messages */}
            {isFromCurrentUser && (
              <MessageStatusIndicator 
                message={message}
                className="ml-1"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}