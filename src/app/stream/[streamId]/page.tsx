import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StreamPlayer from '@/components/livestream/stream-player';
import { prisma } from '@/lib/prisma';

interface StreamPageProps {
  params: {
    streamId: string;
  };
}

async function getStreamData(streamId: string) {
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      include: {
        artist: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          }
        }
      }
    });

    return stream;
  } catch (error) {
    console.error('Failed to fetch stream:', error);
    return null;
  }
}

export async function generateMetadata({ params }: StreamPageProps): Promise<Metadata> {
  const stream = await getStreamData(params.streamId);

  if (!stream) {
    return {
      title: 'Stream Not Found | Direct Fan Platform',
    };
  }

  return {
    title: `${stream.title} | ${stream.artist.displayName} - Live Stream`,
    description: stream.description || `Watch ${stream.artist.displayName}'s live stream`,
    openGraph: {
      title: stream.title,
      description: stream.description || `Watch ${stream.artist.displayName}'s live stream`,
      type: 'video.other',
      images: stream.thumbnailUrl ? [{ url: stream.thumbnailUrl }] : undefined,
    },
    twitter: {
      card: 'player',
      title: stream.title,
      description: stream.description || `Watch ${stream.artist.displayName}'s live stream`,
      images: stream.thumbnailUrl ? [stream.thumbnailUrl] : undefined,
    }
  };
}

export default async function StreamPage({ params }: StreamPageProps) {
  const stream = await getStreamData(params.streamId);

  if (!stream) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <StreamPlayer
          streamId={params.streamId}
          autoplay={stream.status === 'LIVE'}
          showChat={true}
        />
      </div>
    </div>
  );
}