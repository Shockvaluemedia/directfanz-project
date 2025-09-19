'use client';

import React from 'react';
import { ResponsiveHeader } from './ResponsiveHeader';
import { MobileBottomNavigation } from '../navigation/MobileNavigation';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  showMobileNav?: boolean;
}

export function ResponsiveLayout({ children, showMobileNav = true }: ResponsiveLayoutProps) {
  return (
    <div className='min-h-screen bg-gray-50'>
      <ResponsiveHeader />

      <main
        className={`
        ${showMobileNav ? 'pb-20 lg:pb-0' : ''} 
        min-h-[calc(100vh-4rem)]
      `}
      >
        {children}
      </main>

      {showMobileNav && <MobileBottomNavigation />}
    </div>
  );
}
