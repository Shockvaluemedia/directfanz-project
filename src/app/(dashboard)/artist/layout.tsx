import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ArtistSidebar } from '@/components/dashboard/ArtistSidebar';

export default async function ArtistDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'ARTIST') {
    redirect('/');
  }

  return (
    <div className="flex h-screen bg-background">
      <ArtistSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}