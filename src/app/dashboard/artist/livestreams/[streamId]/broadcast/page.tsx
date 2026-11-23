import { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PartyBroadcastStudio from '@/components/livestream/party-broadcast-studio';

export const metadata: Metadata = {
  title: 'Broadcast | DirectFanz',
};

// The only page where the browser allows the camera and microphone (see
// src/lib/security-headers.ts, BROADCAST_PAGE_PATTERN).
export default async function BroadcastPage(props: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const stream = await prisma.live_streams.findUnique({
    where: { id: streamId },
    select: { id: true, artistId: true, title: true, status: true },
  });
  if (!stream || stream.artistId !== session.user.id) notFound();

  return (
    <div className='container mx-auto max-w-4xl space-y-6 px-4 py-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>{stream.title}</h1>
          <p className='text-gray-600'>Listening party broadcast</p>
        </div>
        <Link href='/dashboard/artist/livestreams' className='text-sm text-blue-600 hover:underline'>
          Back to your parties
        </Link>
      </div>
      {stream.status === 'ENDED' || stream.status === 'CANCELLED' ? (
        <p className='text-gray-700'>This party is over.</p>
      ) : (
        <PartyBroadcastStudio streamId={stream.id} />
      )}
    </div>
  );
}
