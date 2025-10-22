'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  HeartIcon,
  UserIcon,
  BellIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  MusicalNoteIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: number;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    id: 'discover',
    label: 'Discover',
    href: '/discover',
    icon: MagnifyingGlassIcon,
  },
  {
    id: 'create',
    label: 'Create',
    href: '/create',
    icon: PlusIcon,
    roles: ['ARTIST'],
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: HeartIcon,
    roles: ['FAN'],
  },
  {
    id: 'content',
    label: 'My Content',
    href: '/dashboard/content',
    icon: MusicalNoteIcon,
    roles: ['ARTIST'],
  },
  {
    id: 'livestream',
    label: 'Live Stream',
    href: '/livestream',
    icon: VideoCameraIcon,
    roles: ['ARTIST'],
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/messages',
    icon: ChatBubbleLeftRightIcon,
    badge: 3,
  },
  {
    id: 'earnings',
    label: 'Earnings',
    href: '/dashboard/earnings',
    icon: BanknotesIcon,
    roles: ['ARTIST'],
  },
];

const settingsItems = [
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: UserIcon,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/notifications',
    icon: BellIcon,
    badge: 2,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
  },
];

interface MobileNavProps {
  className?: string;
}

export default function MobileNav({ className }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return session?.user?.role && item.roles.includes(session.user.role);
  });

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className={`md:hidden ${className}`}>
        <button
          onClick={toggleMenu}
          className='p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors'
          aria-label='Toggle mobile menu'
        >
          {isOpen ? <XMarkIcon className='w-6 h-6' /> : <Bars3Icon className='w-6 h-6' />}
        </button>
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden'
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className='fixed top-0 left-0 w-80 h-full bg-white shadow-xl z-50 md:hidden'
          >
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200'>
              <div className='flex items-center space-x-3'>
                <div className='w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center'>
                  <MusicalNoteIcon className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h2 className='font-semibold text-gray-900'>Direct Fan</h2>
                  <p className='text-xs text-gray-500'>Platform</p>
                </div>
              </div>
              <button
                onClick={toggleMenu}
                className='p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors'
              >
                <XMarkIcon className='w-5 h-5' />
              </button>
            </div>

            {/* User Info */}
            {session?.user && (
              <div className='p-4 border-b border-gray-200'>
                <div className='flex items-center space-x-3'>
                  <div className='w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center'>
                    <span className='text-white font-medium text-sm'>
                      {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                    </span>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-gray-900 truncate'>
                      {session.user.name || 'User'}
                    </p>
                    <p className='text-sm text-gray-500 truncate'>{session.user.email}</p>
                    <span className='inline-block px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full mt-1'>
                      {session.user.role?.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Items */}
            <nav className='flex-1 overflow-y-auto py-4'>
              <div className='px-4'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-3'>
                  Navigation
                </p>
                <div className='space-y-1'>
                  {filteredNavItems.map(item => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-indigo-100 text-indigo-800 border-r-2 border-indigo-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className='w-5 h-5 mr-3 flex-shrink-0' />
                      <span className='flex-1'>{item.label}</span>
                      {item.badge && (
                        <span className='bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center'>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>

                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mt-6 mb-3'>
                  Account
                </p>
                <div className='space-y-1'>
                  {settingsItems.map(item => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-indigo-100 text-indigo-800 border-r-2 border-indigo-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className='w-5 h-5 mr-3 flex-shrink-0' />
                      <span className='flex-1'>{item.label}</span>
                      {item.badge && (
                        <span className='bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center'>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            {/* Sign Out Button */}
            {session?.user && (
              <div className='p-4 border-t border-gray-200'>
                <button
                  onClick={handleSignOut}
                  className='flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 hover:text-red-900 transition-colors'
                >
                  <ArrowLeftOnRectangleIcon className='w-5 h-5 mr-3' />
                  Sign Out
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar (Mobile) */}
      <div className='md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30'>
        <div className='flex items-center justify-around py-2'>
          {filteredNavItems.slice(0, 4).map(item => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center p-2 min-w-0 flex-1 ${
                isActive(item.href) ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className='relative'>
                <item.icon className='w-5 h-5' />
                {item.badge && (
                  <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] h-4 text-center leading-none'>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className='text-xs mt-1 truncate max-w-full'>{item.label}</span>
            </Link>
          ))}
          <button
            onClick={toggleMenu}
            className='flex flex-col items-center p-2 min-w-0 flex-1 text-gray-500 hover:text-gray-700'
          >
            <Bars3Icon className='w-5 h-5' />
            <span className='text-xs mt-1'>More</span>
          </button>
        </div>
      </div>
    </>
  );
}
