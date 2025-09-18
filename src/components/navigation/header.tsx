"use client"

import React, { Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { 
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  ChartBarIcon,
  HomeIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { useNavigationItems, useMobileMenu } from '@/hooks/use-navigation'
import { NotificationSystem } from '@/components/notifications/NotificationSystem'

const iconMap = {
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  ChartBarIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon
}

interface NavigationItem {
  name: string
  href: string
  icon: string
  active: boolean
  description?: string
  badge?: number
}

export default function Header() {
  const router = useRouter()
  const { isOpen, toggle, close } = useMobileMenu()
  const { navigationItems, userMenuItems, isAuthenticated, user } = useNavigationItems()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
    close()
  }

  const renderNavigationItem = (item: NavigationItem, mobile = false) => {
    const Icon = iconMap[item.icon as keyof typeof iconMap]
    const baseClasses = mobile 
      ? "flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors"
      : "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors"
    
    const activeClasses = item.active
      ? "bg-indigo-100 text-indigo-700"
      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={mobile ? close : undefined}
        className={`${baseClasses} ${activeClasses}`}
        title={item.description}
      >
        <Icon className="w-5 h-5 mr-3" />
        {item.name}
        {item.badge && item.badge > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Direct Fan</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigationItems.map(item => renderNavigationItem(item))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            {isAuthenticated && (
              <NotificationSystem />
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <div className="flex items-center space-x-3">
                  {/* User Avatar/Info */}
                  <div className="hidden sm:flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
                    </div>
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      {user?.image ? (
                        <img
                          src={user.image}
                          alt={user.name || 'User'}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                  </div>

                  {/* User Menu Dropdown - Desktop */}
                  <div className="hidden sm:block relative group">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-2">
                        {userMenuItems.map(item => {
                          const Icon = iconMap[item.icon as keyof typeof iconMap]
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Icon className="w-4 h-4 mr-3 text-gray-400" />
                              {item.name}
                            </Link>
                          )
                        })}
                        <hr className="my-2 border-gray-200" />
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <ArrowRightOnRectangleIcon className="w-4 h-4 mr-3 text-gray-400" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-4">
                <Link
                  href="/auth/signin"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={toggle}
              className="md:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              data-mobile-menu
            >
              {isOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-200" data-mobile-menu>
          <div className="px-4 py-6 space-y-2">
            {/* Navigation Items */}
            {navigationItems.map(item => renderNavigationItem(item, true))}
            
            {/* User Section */}
            {isAuthenticated ? (
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center px-4 py-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                    {user?.image ? (
                      <img
                        src={user.image}
                        alt={user.name || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-6 h-6 text-indigo-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user?.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
                  </div>
                </div>
                
                {userMenuItems.map(item => {
                  const Icon = iconMap[item.icon as keyof typeof iconMap]
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={close}
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  )
                })}
                
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <Link
                  href="/auth/signin"
                  onClick={close}
                  className="block px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={close}
                  className="block px-4 py-3 text-base font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}