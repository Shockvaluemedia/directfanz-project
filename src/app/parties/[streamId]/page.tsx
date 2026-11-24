import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getParty } from '@/lib/parties';
import { PartyView } from '@/components/stage/party-view';
import { getViewer } from '@/components/stage/server';

export const dynamic = 'force-dynamic';

interface PartyPageProps {
  params: Promise<{ streamId: string }>;
}

export async function generateMetadata({ params }: PartyPageProps): Promise<Metadata> {
  const party = await getParty((await params).streamId, null);
  if (!party) return { title: 'Party not found | DirectFanz' };
  return {
    title: `${party.title}: ${party.artist.displayName} listening party | DirectFanz`,
    description: party.description ?? `A live listening party with ${party.artist.displayName}.`,
  };
}

// A ticketed listening party. Entry is decided by getParty (canWatch); the
// room itself stays on /stream/:id.
export default async function PartyPage({ params }: PartyPageProps) {
  const { streamId } = await params;
  const viewer = await getViewer();
  const party = await getParty(streamId, viewer.userId);
  if (!party) notFound();

  const artist = await prisma.users.findUnique({
    where: { id: party.artist.id },
    select: { avatar: true },
  });

  const { hasTicket, canWatch, ...details } = party;
  return (
    <PartyView
      party={details}
      artistAvatar={artist?.avatar ?? null}
      viewer={{ signedIn: viewer.signedIn, isFan: viewer.isFan }}
      hasTicket={hasTicket}
      canWatch={canWatch}
    />
  );
}
