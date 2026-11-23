'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HeaderAuth from '@/components/navigation/HeaderAuth';
import { isStagePath } from '@/components/navigation/stage-routes';

// Global header. On fan pages (home, community, drops, parties, membership)
// it is a dark glass bar in the stage style; everywhere else it keeps the
// light app header.
export default function StaticHeader() {
  const stage = isStagePath(usePathname());

  if (!stage) {
    return (
      <header className='bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            <div className='flex-shrink-0 flex items-center'>
              <Link href='/' className='flex items-center'>
                <div className='w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg'>
                  <span className='text-white font-bold text-lg'>DF</span>
                </div>
                <span className='text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'>
                  DirectFanz
                </span>
              </Link>
            </div>
            <div className='flex items-center space-x-4'>
              <HeaderAuth tone='light' />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className='sticky top-0 z-40 border-b border-stage-line bg-stage-ink/85 text-stage-text backdrop-blur-md'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between gap-6'>
          <div className='flex items-center gap-8'>
            <Link href='/' className='flex items-center gap-2.5' aria-label='DirectFanz home'>
              <span
                aria-hidden
                className='flex h-7 w-7 items-center justify-center rounded-control bg-stage-pulse font-mono text-[11px] font-bold text-stage-ink'
              >
                DF
              </span>
              <span className='text-lg font-bold tracking-tight'>DirectFanz</span>
            </Link>
            <nav aria-label='Main'>
              <Link
                href='/community'
                className='text-sm font-medium text-stage-muted transition-colors hover:text-stage-text'
              >
                Community
              </Link>
            </nav>
          </div>

          <div className='flex items-center'>
            <HeaderAuth tone='stage' />
          </div>
        </div>
      </div>
    </header>
  );
}
