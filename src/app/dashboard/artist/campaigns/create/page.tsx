'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CampaignCreator from '@/components/campaigns/campaign-creator';

export default function CreateCampaignPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role !== 'ARTIST') {
      router.push('/dashboard/fan');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
          <p className='mt-3 text-sm text-gray-600'>Loading campaign creator...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <p>Access denied. Artist role required.</p>
      </div>
    );
  }

  return <CampaignCreator />;
}
