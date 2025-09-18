'use client';

import React, { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Message } from '@/types/websocket';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  onMessageRead?: (messageId: string) => void;
  className?: string;
}

export function MessageList({ 
  messages, 
  currentUserId,
  onMessageRead,
  className = ''
}: MessageListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Set up intersection observer for read receipts
  useEffect(() => {
    if (!onMessageRead || !currentUserId) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            const messageId = entry.target.dataset.messageId;
            const senderId = entry.target.dataset.senderId;
            const readAt = entry.target.dataset.readAt;
            
            // Only mark messages as read if:
            // 1. Message is from another user
            // 2. Message hasn't been read yet
            if (messageId && senderId !== currentUserId && !readAt) {
              onMessageRead(messageId);
            }
          }
        });
      },
      {
        threshold: 0.5, // Message is considered read when 50% visible
        rootMargin: '0px 0px -10px 0px'
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [currentUserId, onMessageRead]);

  // Observe message elements
  useEffect(() => {
    if (!observerRef.current) return;

    messageRefs.current.forEach((element, messageId) => {
      if (element) {
        observerRef.current!.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        messageRefs.current.forEach((element) => {
          if (element) {
            observerRef.current!.unobserve(element);
          }
        });
      }
    };
  }, [messages]);

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className={`p-4 space-y-1 ${className}`}>
      {groupedMessages.map((group) => (
        <div key={group.date} className="space-y-1">
          {/* Date separator */}
          <div className="flex justify-center py-2">
            <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-400">
              {formatDateGroup(group.date)}
            </span>
          </div>

          {/* Messages */}
          {group.messages.map((message, index) => {
            const isFromCurrentUser = message.senderId === currentUserId;
            const previousMessage = group.messages[index - 1];
            const nextMessage = group.messages[index + 1];
            
            const showAvatar = !isFromCurrentUser && (
              !nextMessage || 
              nextMessage.senderId !== message.senderId ||
              getTimeDifference(new Date(message.createdAt), new Date(nextMessage.createdAt)) > 5
            );
            
            const showTimestamp = 
              !nextMessage ||
              nextMessage.senderId !== message.senderId ||
              getTimeDifference(new Date(message.createdAt), new Date(nextMessage.createdAt)) > 5;

            const isGrouped = 
              previousMessage &&
              previousMessage.senderId === message.senderId &&
              getTimeDifference(new Date(previousMessage.createdAt), new Date(message.createdAt)) <= 5;

            return (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(message.id, el);
                  } else {
                    messageRefs.current.delete(message.id);
                  }
                }}
                data-message-id={message.id}
                data-sender-id={message.senderId}
                data-read-at={message.readAt}
                className="scroll-mt-4"
              >
                <MessageBubble
                  message={message}
                  isFromCurrentUser={isFromCurrentUser}
                  showAvatar={showAvatar}
                  showTimestamp={showTimestamp}
                  isGrouped={isGrouped}
                />
              </div>
            );
          })}
        </div>
      ))}

      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No messages yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Start the conversation with a friendly message!
          </p>
        </div>
      )}
    </div>
  );
}

interface MessageGroup {
  date: string;
  messages: Message[];
}

function groupMessagesByDate(messages: Message[]): MessageGroup[] {
  const groups: { [key: string]: Message[] } = {};

  messages.forEach((message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, messages]) => ({
      date,
      messages: messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));
}

function formatDateGroup(dateString: string): string {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMMM d, yyyy');
  }
}

function getTimeDifference(date1: Date, date2: Date): number {
  return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60); // in minutes
}