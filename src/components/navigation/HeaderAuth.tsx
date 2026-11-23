'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

const TONES = {
  light: {
    loading: 'h-9 w-24 animate-pulse rounded-lg bg-gray-100',
    row: 'flex items-center space-x-4',
    link: 'font-medium text-gray-600 hover:text-gray-900',
    secondary:
      'rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200',
    primary:
      'rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700',
  },
  stage: {
    loading: 'h-9 w-24 animate-pulse rounded-control bg-white/5',
    row: 'flex items-center gap-2 sm:gap-4',
    link: 'px-2 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-text',
    secondary:
      'rounded-control border border-stage-line-strong px-4 py-2 text-sm font-medium text-stage-text transition-colors hover:border-white/30',
    primary:
      'rounded-control bg-stage-pulse px-4 py-2 text-sm font-semibold text-stage-ink transition-colors hover:bg-stage-pulse-strong',
  },
};

// Session-aware right side of the global header. Logged-out visitors see
// Sign In / Sign Up; signed-in users see Dashboard / Sign out instead.
export default function HeaderAuth({ tone = 'light' }: { tone?: keyof typeof TONES }) {
  const { data: session, status } = useSession();
  const styles = TONES[tone];

  if (status === 'loading') {
    return <div className={styles.loading} aria-hidden />;
  }

  if (session?.user) {
    return (
      <div className={styles.row}>
        <Link href='/dashboard' className={styles.link}>
          Dashboard
        </Link>
        <button onClick={() => signOut({ callbackUrl: '/' })} className={styles.secondary}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <Link href='/auth/signin' className={styles.link}>
        Sign In
      </Link>
      <Link href='/auth/signup' className={styles.primary}>
        Sign Up
      </Link>
    </div>
  );
}
