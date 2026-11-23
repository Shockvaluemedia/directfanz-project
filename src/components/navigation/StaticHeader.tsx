import Link from 'next/link';
import HeaderAuth from '@/components/navigation/HeaderAuth';

// Global header in the stage style: a dark glass bar, the wordmark, the
// community link, then session-aware controls.
export default function StaticHeader() {
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
            <HeaderAuth />
          </div>
        </div>
      </div>
    </header>
  );
}
