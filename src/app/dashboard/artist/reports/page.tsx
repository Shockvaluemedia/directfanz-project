'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ReleaseReport from '@/components/artist/release-report';

/** Per-release report. Artists see their own drops; admins see every artist's, read only. */
export default function ReleaseReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (role !== 'ARTIST' && role !== 'ADMIN') {
      router.push('/dashboard/fan');
    }
  }, [session, status, role, router]);

  if (status === 'loading' || !session || (role !== 'ARTIST' && role !== 'ADMIN')) {
    return null;
  }

  return (
    <main className='min-h-screen bg-black px-4 py-10'>
      <div className='mx-auto max-w-7xl'>
        <ReleaseReport admin={role === 'ADMIN'} />
      </div>
    </main>
  );
}
