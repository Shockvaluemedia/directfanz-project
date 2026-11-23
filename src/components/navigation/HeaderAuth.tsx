'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

// Session-aware right side of the global header. Logged-out visitors see
// Sign In / Sign Up; signed-in users see Dashboard / Sign out instead.
export default function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="h-9 w-24 animate-pulse rounded-control bg-white/5" aria-hidden />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/dashboard" className="px-2 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-text">
          Dashboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-control border border-stage-line-strong px-4 py-2 text-sm font-medium text-stage-text transition-colors hover:border-white/30"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <Link href="/auth/signin" className="px-2 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-text">
        Sign In
      </Link>
      <Link
        href="/auth/signup"
        className="rounded-control bg-stage-pulse px-4 py-2 text-sm font-semibold text-stage-ink transition-colors hover:bg-stage-pulse-strong"
      >
        Sign Up
      </Link>
    </div>
  );
}
