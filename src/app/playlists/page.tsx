import { PlaylistManager } from '@/components/playlists/PlaylistManager';

export const metadata = {
  title: 'Playlists | DirectFanz',
  description: 'Discover and create music playlists',
};

export default function PlaylistsPage() {
  return (
    <div className='container mx-auto px-4 py-8'>
      <PlaylistManager />
    </div>
  );
}
