import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StreamScheduler from '@/components/artist/stream-scheduler';

export const metadata: Metadata = {
  title: 'Live Streams | Direct Fan Platform',
  description: 'Schedule and manage your live streaming sessions with fans.',
};

export default async function LivestreamsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'ARTIST') {
    redirect('/dashboard');
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <StreamScheduler />
    </div>
  );
}
