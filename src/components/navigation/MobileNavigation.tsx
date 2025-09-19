'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Home,
  Search,
  Music,
  MessageCircle,
  User,
  Plus,
  BarChart3,
  Settings,
  Bell,
  X,
} from 'lucide-react';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Handle swipe to close
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && isOpen) {
      onClose();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Prevent body scroll when nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const isActive = (path: string) => pathname === path;
  const isArtist = session?.user?.role === 'ARTIST';
  const isFan = session?.user?.role === 'FAN';

  const navigationItems = [
    // Common items
    {
      name: 'Home',
      href: '/',
      icon: Home,
      show: true,
    },
    {
      name: 'Discover',
      href: '/discover',
      icon: Search,
      show: true,
    },
    // Artist-specific items
    {
      name: 'Dashboard',
      href: '/dashboard/artist',
      icon: BarChart3,
      show: isArtist,
    },
    {
      name: 'Upload Content',
      href: '/dashboard/artist/upload',
      icon: Plus,
      show: isArtist,
    },
    {
      name: 'My Content',
      href: '/dashboard/artist/content',
      icon: Music,
      show: isArtist,
    },
    // Fan-specific items
    {
      name: 'My Subscriptions',
      href: '/dashboard/fan/subscriptions',
      icon: Music,
      show: isFan,
    },
    // Common authenticated items
    {
      name: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      show: !!session,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      show: !!session,
    },
    {
      name: 'Settings',
      href: '/profile/settings',
      icon: Settings,
      show: !!session,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 lg:hidden
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Navigation Drawer */}
      <div
        ref={navRef}
        className={`
          fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200'>
          <div className='flex items-center'>
            <div className='w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3'>
              <span className='text-white font-bold text-lg'>D</span>
            </div>
            <span className='text-xl font-bold text-gray-900'>Direct Fan</span>
          </div>
          <button
            onClick={onClose}
            className='p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors'
          >
            <X size={20} />
          </button>
        </div>

        {/* User Info */}
        {session && (
          <div className='p-4 border-b border-gray-200'>
            <div className='flex items-center'>
              <div className='w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center'>
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || session.user.email || 'User'}
                    className='w-12 h-12 rounded-full'
                  />
                ) : (
                  <User size={20} className='text-gray-500' />
                )}
              </div>
              <div className='ml-3'>
                <p className='text-sm font-medium text-gray-900'>
                  {session.user.name || session.user.email}
                </p>
                <p className='text-xs text-gray-500 capitalize'>
                  {session.user.role?.toLowerCase()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className='flex-1 py-4'>
          <div className='space-y-1'>
            {navigationItems
              .filter(item => item.show)
              .map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center px-4 py-3 text-sm font-medium transition-colors mx-2 rounded-lg
                      ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon
                      size={20}
                      className={`
                        mr-3 flex-shrink-0
                        ${active ? 'text-indigo-700' : 'text-gray-400'}
                      `}
                    />
                    {item.name}

                    {/* Notification badge for messages */}
                    {item.name === 'Messages' && (
                      <span className='ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center'>
                        3
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        </nav>

        {/* Footer */}
        <div className='border-t border-gray-200 p-4'>
          {session ? (
            <button
              onClick={() => {
                // Handle sign out
                window.location.href = '/api/auth/signout';
              }}
              className='w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors'
            >
              <User size={16} className='mr-3' />
              Sign Out
            </button>
          ) : (
            <div className='space-y-2'>
              <Link
                href='/auth/signin'
                onClick={onClose}
                className='w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors'
              >
                Sign In
              </Link>
              <Link
                href='/auth/signup'
                onClick={onClose}
                className='w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors'
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function MobileBottomNavigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isArtist = session?.user?.role === 'ARTIST';
  const isFan = session?.user?.role === 'FAN';

  const isActive = (path: string) => pathname === path || pathname.startsWith(path);

  const bottomNavItems = [
    {
      name: 'Home',
      href: '/',
      icon: Home,
      show: true,
    },
    {
      name: 'Discover',
      href: '/discover',
      icon: Search,
      show: true,
    },
    {
      name: 'Create',
      href: isArtist ? '/dashboard/artist/upload' : '/auth/signup',
      icon: Plus,
      show: true,
    },
    {
      name: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      show: !!session,
      badge: 3,
    },
    {
      name: 'Profile',
      href: isArtist ? '/dashboard/artist' : isFan ? '/dashboard/fan' : '/profile',
      icon: User,
      show: true,
    },
  ];

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-30'>
      <div className='flex'>
        {bottomNavItems
          .filter(item => item.show)
          .map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex-1 flex flex-col items-center py-2 px-1 relative
                  ${active ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                <div className='relative'>
                  <Icon size={20} />
                  {item.badge && item.badge > 0 && (
                    <span className='absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center text-[10px]'>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className='text-xs mt-1 text-center leading-none'>{item.name}</span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
