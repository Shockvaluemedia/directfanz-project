import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ArtistDiscovery from '@/components/fan/artist-discovery';

export default async function DiscoverPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin');
  }

  if (session.user.role !== 'FAN') {
    redirect('/dashboard/artist');
  }

  return <ArtistDiscovery />;
}
