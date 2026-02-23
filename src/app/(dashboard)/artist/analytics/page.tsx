import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { AdvancedAnalyticsDashboard } from '@/components/analytics/AdvancedAnalyticsDashboard';

export const metadata = {
  title: 'Analytics | DirectFanz',
  description: 'Comprehensive analytics and insights for your content',
};

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'ARTIST') {
    redirect('/');
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <AdvancedAnalyticsDashboard />
    </div>
  );
}
