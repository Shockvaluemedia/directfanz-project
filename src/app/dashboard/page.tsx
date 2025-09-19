'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DashboardIndex() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      // Not signed in - send to signin with callback back to dashboard
      const url = new URL('/auth/signin', window.location.origin);
      url.searchParams.set('callbackUrl', '/dashboard');
      router.replace(url.toString());
      return;
    }

    const role = (session.user as any).role || 'FAN';
    if (role === 'ARTIST') {
      router.replace('/dashboard/artist');
    } else {
      router.replace('/dashboard/fan');
    }
  }, [session, status, router]);

  return (
    <div className='min-h-[40vh] flex items-center justify-center'>
      <div className='text-center text-gray-600'>Loading your dashboard...</div>
    </div>
  );
}
