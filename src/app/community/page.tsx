import { notFound } from 'next/navigation';
import { CommunityHome } from '@/components/stage/community-home';

export const dynamic = 'force-dynamic';

// The community home: the headliner first, then music and video drops,
// listening parties and premieres, and the rest of the roster.
export default async function CommunityPage() {
  const home = await CommunityHome();
  if (!home) notFound();
  return home;
}
