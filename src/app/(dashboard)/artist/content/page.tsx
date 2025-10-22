import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ContentDashboard } from '@/components/dashboard/ContentDashboard';

export const metadata = {
  title: 'Content Management | DirectFanz',
  description: 'Manage your content and track performance',
};

export default async function ContentManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'ARTIST') {
    redirect('/');
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <ContentDashboard />
    </div>
  );
}
