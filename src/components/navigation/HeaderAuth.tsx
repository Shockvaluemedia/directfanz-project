'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

// Session-aware right side of the global header. Logged-out visitors see
// Sign In / Sign Up; signed-in users see Dashboard / Sign out instead.
export default function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" aria-hidden />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center space-x-4">
        <Link href="/dashboard" className="font-medium text-gray-600 hover:text-gray-900">
          Dashboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <Link href="/auth/signin" className="font-medium text-gray-600 hover:text-gray-900">
        Sign In
      </Link>
      <Link
        href="/auth/signup"
        className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Sign Up
      </Link>
    </div>
  );
}
