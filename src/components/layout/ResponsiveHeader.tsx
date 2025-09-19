'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Menu, Bell, Search, User } from 'lucide-react';
import { MobileNavigation } from '../navigation/MobileNavigation';

export function ResponsiveHeader() {
  const { data: session } = useSession();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isArtist = session?.user?.role === 'ARTIST';
  const isFan = session?.user?.role === 'FAN';

  return (
    <>
      <header className='bg-white border-b border-gray-200 sticky top-0 z-20'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            {/* Mobile menu button */}
            <div className='flex items-center lg:hidden'>
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
                aria-label='Open menu'
              >
                <Menu size={20} />
              </button>
            </div>

            {/* Logo */}
            <div className='flex items-center'>
              <Link href='/' className='flex items-center'>
                <div className='w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3'>
                  <span className='text-white font-bold text-lg'>D</span>
                </div>
                <span className='text-xl font-bold text-gray-900 hidden sm:block'>Direct Fan</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className='hidden lg:flex items-center space-x-8'>
              <Link
                href='/discover'
                className='text-gray-600 hover:text-gray-900 transition-colors'
              >
                Discover
              </Link>

              {isArtist && (
                <>
                  <Link
                    href='/dashboard/artist'
                    className='text-gray-600 hover:text-gray-900 transition-colors'
                  >
                    Dashboard
                  </Link>
                  <Link
                    href='/dashboard/artist/upload'
                    className='text-gray-600 hover:text-gray-900 transition-colors'
                  >
                    Upload
                  </Link>
                </>
              )}

              {isFan && (
                <Link
                  href='/dashboard/fan'
                  className='text-gray-600 hover:text-gray-900 transition-colors'
                >
                  My Subscriptions
                </Link>
              )}

              {session && (
                <Link
                  href='/messages'
                  className='text-gray-600 hover:text-gray-900 transition-colors relative'
                >
                  Messages
                  <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center'>
                    3
                  </span>
                </Link>
              )}
            </nav>

            {/* Right side actions */}
            <div className='flex items-center space-x-2'>
              {/* Search */}
              <div className='hidden sm:block'>
                <div className='relative'>
                  <input
                    type='text'
                    placeholder='Search artists, content...'
                    className='w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                  />
                  <Search
                    className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400'
                    size={16}
                  />
                </div>
              </div>

              {/* Mobile search button */}
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className='sm:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
                aria-label='Search'
              >
                <Search size={20} />
              </button>

              {/* Notifications */}
              {session && (
                <button className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors relative'>
                  <Bell size={20} />
                  <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center'>
                    5
                  </span>
                </button>
              )}

              {/* User menu */}
              {session ? (
                <div className='hidden lg:flex items-center'>
                  <Link
                    href={isArtist ? '/dashboard/artist' : isFan ? '/dashboard/fan' : '/profile'}
                    className='flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors'
                  >
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || session.user.email || 'User'}
                        className='w-8 h-8 rounded-full'
                      />
                    ) : (
                      <div className='w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center'>
                        <User size={16} className='text-gray-500' />
                      </div>
                    )}
                    <span className='ml-2 text-sm font-medium text-gray-700'>
                      {session.user.name || session.user.email}
                    </span>
                  </Link>
                </div>
              ) : (
                <div className='hidden lg:flex items-center space-x-3'>
                  <Link
                    href='/auth/signin'
                    className='text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors'
                  >
                    Sign In
                  </Link>
                  <Link
                    href='/auth/signup'
                    className='bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors'
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile search bar */}
          {isSearchOpen && (
            <div className='sm:hidden py-3 border-t border-gray-200'>
              <div className='relative'>
                <input
                  type='text'
                  placeholder='Search artists, content...'
                  className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                  autoFocus
                />
                <Search
                  className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400'
                  size={16}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation */}
      <MobileNavigation isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
    </>
  );
}
