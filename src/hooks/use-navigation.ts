'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export function useActiveRoute() {
  const pathname = usePathname();

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return { pathname, isActive };
}

export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  // Close mobile menu when clicking outside or on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-mobile-menu]')) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('click', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return { isOpen, toggle, close, open };
}

export function useNavigationItems() {
  const { data: session, status } = useSession();
  const { isActive } = useActiveRoute();

  // Return early if session is still loading
  if (status === 'loading') {
    return {
      navigationItems: [],
      userMenuItems: [],
      isAuthenticated: false,
      user: null,
    };
  }

  const getNavigationItems = () => {
    const baseItems = [
      {
        name: 'Discover',
        href: '/search',
        icon: 'MagnifyingGlassIcon',
        active: isActive('/search'),
        description: 'Find new artists and content',
      },
    ];

    if (!session) {
      return baseItems;
    }

    const authenticatedItems = [
      ...baseItems,
      {
        name: 'Messages',
        href: '/messages',
        icon: 'ChatBubbleLeftIcon',
        active: isActive('/messages'),
        description: 'Your conversations',
        badge: 0, // TODO: Add unread message count
      },
    ];

    // Role-specific items
    if (session.user.role === 'ARTIST') {
      authenticatedItems.push({
        name: 'Dashboard',
        href: '/dashboard/artist',
        icon: 'ChartBarIcon',
        active: isActive('/dashboard/artist'),
        description: 'Artist analytics and management',
      });
    } else if (session.user.role === 'FAN') {
      authenticatedItems.push({
        name: 'Dashboard',
        href: '/dashboard/fan',
        icon: 'HomeIcon',
        active: isActive('/dashboard/fan'),
        description: 'Your subscriptions and activity',
      });
    }

    // Admin items
    if (session.user.role === 'ADMIN') {
      authenticatedItems.push({
        name: 'Moderation',
        href: '/admin/moderation',
        icon: 'ShieldCheckIcon',
        active: isActive('/admin'),
        description: 'Content moderation tools',
      });
    }

    return authenticatedItems;
  };

  const getUserMenuItems = () => {
    if (!session) return [];

    return [
      {
        name: 'Profile Settings',
        href: '/profile/settings',
        icon: 'UserIcon',
      },
      {
        name: 'Billing',
        href: '/profile/billing',
        icon: 'CreditCardIcon',
      },
      {
        name: 'Help & Support',
        href: '/support',
        icon: 'QuestionMarkCircleIcon',
      },
    ];
  };

  return {
    navigationItems: getNavigationItems(),
    userMenuItems: getUserMenuItems(),
    isAuthenticated: !!session,
    user: session?.user,
  };
}

export function useBreadcrumbs() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return [{ name: 'Home', href: '/' }];
  }

  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', href: '/' }];

    let currentPath = '';

    for (const segment of segments) {
      currentPath += `/${segment}`;

      // Map segments to readable names
      let name = segment.charAt(0).toUpperCase() + segment.slice(1);

      switch (segment) {
        case 'dashboard':
          name = 'Dashboard';
          break;
        case 'artist':
          name = session?.user.role === 'ARTIST' ? 'Artist Dashboard' : 'Artist';
          break;
        case 'fan':
          name = session?.user.role === 'FAN' ? 'Fan Dashboard' : 'Fan';
          break;
        case 'messages':
          name = 'Messages';
          break;
        case 'search':
          name = 'Discover';
          break;
        case 'profile':
          name = 'Profile';
          break;
        case 'settings':
          name = 'Settings';
          break;
        case 'admin':
          name = 'Admin';
          break;
        case 'moderation':
          name = 'Moderation';
          break;
        default:
          // Keep the capitalized version
          break;
      }

      breadcrumbs.push({ name, href: currentPath });
    }

    return breadcrumbs;
  };

  return { breadcrumbs: generateBreadcrumbs() };
}
