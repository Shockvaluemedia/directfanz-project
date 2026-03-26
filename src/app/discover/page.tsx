import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ArtistDiscovery from '@/components/fan/artist-discovery';
import { generateMetadata as generateSEO } from '@/lib/seo';

export const metadata = generateSEO({
  title: 'Discover Creators',
  description: 'Discover talented creators on DirectFanz. Find artists, subscribe to exclusive content, and connect with your favorites.',
  url: '/discover',
});

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
