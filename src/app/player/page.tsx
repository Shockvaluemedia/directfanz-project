'use client';

import React, { useState } from 'react';
import InteractiveMediaPlayer from '@/components/media/InteractiveMediaPlayer';
import PlaylistManager from '@/components/media/PlaylistManager';
import { MediaTrack, Playlist } from '@/types/media';

// Sample data for demonstration
const sampleTracks: MediaTrack[] = [
  {
    id: '1',
    title: 'Midnight Groove',
    artist: 'Jazz Collective',
    album: 'Late Night Sessions',
    duration: 245,
    url: '/audio/sample-1.mp3',
    thumbnail: '/images/album-1.jpg',
    genre: 'Jazz',
    releaseYear: 2023,
    isLiked: true,
    playCount: 1247,
    lyrics: [
      { timestamp: 0, text: 'When the midnight hour calls' },
      { timestamp: 5000, text: "We gather 'round the stage" },
      { timestamp: 10000, text: 'Jazz fills the smoky air' },
      { timestamp: 15000, text: "Lost in the rhythm's cage" },
    ],
  },
  {
    id: '2',
    title: 'Electric Dreams',
    artist: 'Synthwave Stars',
    album: 'Neon Nights',
    duration: 198,
    url: '/audio/sample-2.mp3',
    thumbnail: '/images/album-2.jpg',
    genre: 'Electronic',
    releaseYear: 2024,
    isLiked: false,
    playCount: 892,
    lyrics: [
      { timestamp: 0, text: 'Neon lights illuminate the dark' },
      { timestamp: 4500, text: 'Synthesizers paint the night' },
      { timestamp: 9000, text: 'In this electric wonderland' },
      { timestamp: 13500, text: 'Everything feels so right' },
    ],
  },
  {
    id: '3',
    title: 'Acoustic Soul',
    artist: 'Folk Heroes',
    album: 'Unplugged Sessions',
    duration: 312,
    url: '/audio/sample-3.mp3',
    thumbnail: '/images/album-3.jpg',
    genre: 'Folk',
    releaseYear: 2023,
    isLiked: true,
    playCount: 2156,
  },
];

const samplePlaylist: Playlist = {
  id: 'demo-playlist',
  name: 'Demo Playlist',
  description: 'A sample playlist showcasing the Interactive Media Player',
  tracks: sampleTracks,
  thumbnail: '/images/playlist-demo.jpg',
  isPublic: true,
  isCollaborative: false,
  tags: ['demo', 'showcase', 'mixed'],
  owner: {
    id: 'user-1',
    name: 'Demo User',
    avatar: '/images/user-avatar.jpg',
  },
  collaborators: [],
  stats: {
    totalDuration: sampleTracks.reduce((sum, track) => sum + track.duration, 0),
    totalPlays: 5432,
    followers: 128,
    likes: 89,
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
};

export default function PlayerPage() {
  const [currentTrack, setCurrentTrack] = useState<MediaTrack | null>(sampleTracks[0]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist>(samplePlaylist);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  const handleTrackPlay = (track: MediaTrack, playlist?: Playlist) => {
    setCurrentTrack(track);
    if (playlist) {
      setCurrentPlaylist(playlist);
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setCurrentPlaylist(playlist);
    if (playlist.tracks.length > 0) {
      setCurrentTrack(playlist.tracks[0]);
    }
  };

  return (
    <div className='min-h-screen bg-gray-900'>
      <div className='max-w-7xl mx-auto p-6'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-white mb-2'>Interactive Media Player</h1>
          <p className='text-gray-400'>
            Experience advanced audio playback with real-time visualizations, lyrics sync, and
            social features
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Main Player */}
          <div className='lg:col-span-3'>
            <InteractiveMediaPlayer
              initialTrack={currentTrack}
              playlist={currentPlaylist}
              showComments={true}
              showLyrics={true}
              showVisualizer={true}
              compact={false}
            />
          </div>

          {/* Playlist Sidebar */}
          <div className='lg:col-span-1'>
            <PlaylistManager
              onPlaylistSelect={handlePlaylistSelect}
              onTrackPlay={handleTrackPlay}
              selectedPlaylistId={currentPlaylist.id}
              compact={true}
              className='h-full'
            />
          </div>
        </div>

        {/* Features Overview */}
        <div className='mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          <div className='bg-gray-800 rounded-lg p-6'>
            <div className='w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4'>
              🎵
            </div>
            <h3 className='text-lg font-semibold text-white mb-2'>Audio Visualizer</h3>
            <p className='text-gray-400 text-sm'>
              Real-time frequency analysis with multiple visualization modes
            </p>
          </div>

          <div className='bg-gray-800 rounded-lg p-6'>
            <div className='w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4'>
              📝
            </div>
            <h3 className='text-lg font-semibold text-white mb-2'>Synced Lyrics</h3>
            <p className='text-gray-400 text-sm'>
              Time-synchronized lyrics with manual offset adjustment
            </p>
          </div>

          <div className='bg-gray-800 rounded-lg p-6'>
            <div className='w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4'>
              🎚️
            </div>
            <h3 className='text-lg font-semibold text-white mb-2'>10-Band EQ</h3>
            <p className='text-gray-400 text-sm'>
              Professional equalizer with real-time audio processing
            </p>
          </div>

          <div className='bg-gray-800 rounded-lg p-6'>
            <div className='w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4'>
              💬
            </div>
            <h3 className='text-lg font-semibold text-white mb-2'>Social Features</h3>
            <p className='text-gray-400 text-sm'>Timestamped comments, likes, and track sharing</p>
          </div>
        </div>

        {/* Technical Specs */}
        <div className='mt-12 bg-gray-800 rounded-lg p-6'>
          <h3 className='text-xl font-semibold text-white mb-4'>Technical Features</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <h4 className='font-medium text-white mb-2'>Audio Processing</h4>
              <ul className='text-sm text-gray-400 space-y-1'>
                <li>• Web Audio API integration</li>
                <li>• Real-time spectrum analysis</li>
                <li>• 10-band parametric equalizer</li>
                <li>• Crossfade transitions</li>
                <li>• Gapless playback</li>
              </ul>
            </div>
            <div>
              <h4 className='font-medium text-white mb-2'>User Experience</h4>
              <ul className='text-sm text-gray-400 space-y-1'>
                <li>• Drag & drop playlist management</li>
                <li>• Keyboard shortcuts</li>
                <li>• Mobile touch controls</li>
                <li>• Responsive design</li>
                <li>• Accessibility features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
