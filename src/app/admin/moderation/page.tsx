'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModerationDashboard from '@/components/admin/moderation-dashboard';
import { LoadingSpinner } from '@/components/ui/loading';

export default function AdminModerationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <LoadingSpinner size='lg' />
          <p className='mt-3 text-sm text-gray-600'>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null; // Router will redirect
  }

  return <ModerationDashboard />;
}
