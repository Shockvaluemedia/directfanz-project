import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DROP_STATUS, toPublicDrop } from '@/lib/drops';
import { hasPaidPurchase } from '@/lib/purchases';
import { DropView } from '@/components/stage/drop-view';
import { getActiveTier, getViewer, toStageDrop, viewerIsMember } from '@/components/stage/server';

export const dynamic = 'force-dynamic';

interface DropPageProps {
  params: Promise<{ id: string }>;
}

async function loadDrop(id: string) {
  const drop = await prisma.drops.findUnique({
    where: { id },
    include: { drop_content: { select: { contentId: true } } },
  });
  if (!drop || drop.status === DROP_STATUS.DRAFT) return null;
  const artist = await prisma.users.findUnique({
    where: { id: drop.artistId },
    select: { displayName: true, avatar: true },
  });
  return { drop, artist };
}

export async function generateMetadata({ params }: DropPageProps): Promise<Metadata> {
  const loaded = await loadDrop((await params).id);
  if (!loaded) return { title: 'Drop not found | DirectFanz' };
  const name = loaded.artist?.displayName ?? 'DirectFanz';
  return {
    title: `${loaded.drop.title} by ${name} | DirectFanz`,
    description: loaded.drop.description ?? `A drop from ${name} on DirectFanz.`,
  };
}

// One drop: what it is, when it opens, what's left and the buy button.
// Buying goes through the existing purchase checkout route.
export default async function DropPage({ params }: DropPageProps) {
  const loaded = await loadDrop((await params).id);
  if (!loaded) notFound();
  const { drop, artist } = loaded;

  const viewer = await getViewer();
  const [owned, isMember, tier] = await Promise.all([
    viewer.userId ? hasPaidPurchase(viewer.userId, 'DROP', drop.id) : Promise.resolve(false),
    viewerIsMember(viewer.userId, drop.artistId),
    getActiveTier(drop.artistId),
  ]);

  return (
    <DropView
      drop={toStageDrop(toPublicDrop(drop), artist?.displayName ?? '', null, drop.quantityLimit)}
      artistAvatar={artist?.avatar ?? null}
      viewer={{ signedIn: viewer.signedIn, isFan: viewer.isFan, isMember }}
      owned={owned}
      tier={tier}
    />
  );
}
