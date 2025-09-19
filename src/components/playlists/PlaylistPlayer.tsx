'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  List,
  Minimize2,
  Maximize2,
  Heart,
  Share2,
  MoreHorizontal,
} from 'lucide-react';
import { VideoPlayer } from '../media/VideoPlayer';
import { AudioPlayer } from '../media/AudioPlayer';
import { ImageViewer } from '../media/ImageViewer';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface PlaylistTrack {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  artist: {
    id: string;
    name: string;
    image?: string;
  };
}

interface PlaylistData {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  tracks: PlaylistTrack[];
}

interface PlaylistPlayerProps {
  playlist: PlaylistData;
  initialTrackIndex?: number;
  onTrackChange?: (trackIndex: number) => void;
  onPlaylistEnd?: () => void;
  className?: string;
}

type RepeatMode = 'none' | 'all' | 'one';

export function PlaylistPlayer({
  playlist,
  initialTrackIndex = 0,
  onTrackChange,
  onPlaylistEnd,
  className,
}: PlaylistPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(initialTrackIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [playHistory, setPlayHistory] = useState<number[]>([]);

  const currentTrack = playlist.tracks[currentTrackIndex];
  const playerRef = useRef<any>(null);

  // Initialize shuffled indices
  useEffect(() => {
    const indices = Array.from({ length: playlist.tracks.length }, (_, i) => i);
    setShuffledIndices(shuffleArray([...indices]));
  }, [playlist.tracks.length]);

  const shuffleArray = (array: number[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(
        (crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * (i + 1)
      );
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const getNextTrackIndex = useCallback(() => {
    if (repeatMode === 'one') {
      return currentTrackIndex;
    }

    if (isShuffleEnabled) {
      const currentShuffledPosition = shuffledIndices.indexOf(currentTrackIndex);
      const nextShuffledPosition = (currentShuffledPosition + 1) % shuffledIndices.length;
      return shuffledIndices[nextShuffledPosition];
    }

    const nextIndex = (currentTrackIndex + 1) % playlist.tracks.length;
    if (nextIndex === 0 && repeatMode === 'none') {
      return -1; // End of playlist
    }
    return nextIndex;
  }, [currentTrackIndex, isShuffleEnabled, repeatMode, shuffledIndices, playlist.tracks.length]);

  const getPreviousTrackIndex = useCallback(() => {
    if (playHistory.length > 0) {
      const previousIndex = playHistory[playHistory.length - 1];
      setPlayHistory(prev => prev.slice(0, -1));
      return previousIndex;
    }

    if (isShuffleEnabled) {
      const currentShuffledPosition = shuffledIndices.indexOf(currentTrackIndex);
      const prevShuffledPosition =
        currentShuffledPosition === 0 ? shuffledIndices.length - 1 : currentShuffledPosition - 1;
      return shuffledIndices[prevShuffledPosition];
    }

    return currentTrackIndex === 0 ? playlist.tracks.length - 1 : currentTrackIndex - 1;
  }, [currentTrackIndex, isShuffleEnabled, shuffledIndices, playHistory, playlist.tracks.length]);

  const playTrack = (trackIndex: number) => {
    if (trackIndex === currentTrackIndex) {
      setIsPlaying(true);
      return;
    }

    // Add current track to history
    setPlayHistory(prev => [...prev, currentTrackIndex]);
    setCurrentTrackIndex(trackIndex);
    setIsPlaying(true);
    onTrackChange?.(trackIndex);
  };

  const playNext = () => {
    const nextIndex = getNextTrackIndex();
    if (nextIndex === -1) {
      setIsPlaying(false);
      onPlaylistEnd?.();
      return;
    }
    playTrack(nextIndex);
  };

  const playPrevious = () => {
    const previousIndex = getPreviousTrackIndex();
    playTrack(previousIndex);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleShuffle = () => {
    setIsShuffleEnabled(!isShuffleEnabled);
    if (!isShuffleEnabled) {
      // Generate new shuffle when enabling
      setShuffledIndices(shuffleArray(Array.from({ length: playlist.tracks.length }, (_, i) => i)));
    }
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one':
        return <Repeat className='h-4 w-4' />;
      case 'all':
        return <Repeat className='h-4 w-4' />;
      default:
        return <Repeat className='h-4 w-4' />;
    }
  };

  const renderMediaPlayer = () => {
    if (!currentTrack) return null;

    const playerProps = {
      key: currentTrack.id,
      contentId: currentTrack.id,
      title: currentTrack.title,
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onEnded: playNext,
    };

    switch (currentTrack.type.toLowerCase()) {
      case 'video':
        return (
          <VideoPlayer
            {...playerProps}
            src={currentTrack.fileUrl}
            poster={currentTrack.thumbnailUrl}
            className='w-full'
          />
        );
      case 'audio':
        return (
          <AudioPlayer
            {...playerProps}
            src={currentTrack.fileUrl}
            artist={currentTrack.artist.name}
            artwork={currentTrack.thumbnailUrl}
            className='w-full'
          />
        );
      case 'image':
        return (
          <ImageViewer
            {...playerProps}
            src={currentTrack.fileUrl}
            alt={currentTrack.title}
            className='w-full'
          />
        );
      default:
        return (
          <div className='aspect-video bg-muted flex items-center justify-center rounded-lg'>
            <div className='text-center'>
              <p className='text-muted-foreground mb-2'>
                Unsupported content type: {currentTrack.type}
              </p>
              <Button variant='outline' onClick={playNext}>
                Skip to Next
              </Button>
            </div>
          </div>
        );
    }
  };

  const QueueItem = ({
    track,
    index,
    isActive,
  }: {
    track: PlaylistTrack;
    index: number;
    isActive: boolean;
  }) => (
    <div
      className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer ${
        isActive ? 'bg-primary/10 border border-primary/20' : ''
      }`}
      onClick={() => playTrack(index)}
    >
      <div className='w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0'>
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className='w-full h-full object-cover rounded'
          />
        ) : (
          <Play className='h-4 w-4' />
        )}
      </div>

      <div className='flex-grow min-w-0'>
        <h4 className={`font-medium line-clamp-1 ${isActive ? 'text-primary' : ''}`}>
          {track.title}
        </h4>
        <p className='text-sm text-muted-foreground'>{track.artist.name}</p>
      </div>

      <div className='text-sm text-muted-foreground'>
        {track.duration ? formatDuration(track.duration) : '--:--'}
      </div>
    </div>
  );

  if (!currentTrack) {
    return (
      <Card className={className}>
        <CardContent className='p-8 text-center'>
          <p className='text-muted-foreground'>No tracks in playlist</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Main Player */}
      <Card className={`overflow-hidden transition-all duration-300 ${isMinimized ? 'h-32' : ''}`}>
        <CardContent className='p-0'>
          {!isMinimized && <div className='aspect-video'>{renderMediaPlayer()}</div>}

          {/* Player Controls */}
          <div className={`p-4 bg-card border-t ${isMinimized ? 'h-32' : ''}`}>
            {/* Track Info */}
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                {isMinimized && currentTrack.thumbnailUrl && (
                  <img
                    src={currentTrack.thumbnailUrl}
                    alt={currentTrack.title}
                    className='w-12 h-12 rounded object-cover'
                  />
                )}
                <div>
                  <h3 className='font-semibold line-clamp-1'>{currentTrack.title}</h3>
                  <p className='text-sm text-muted-foreground'>{currentTrack.artist.name}</p>
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <Button variant='ghost' size='sm' onClick={() => setIsMinimized(!isMinimized)}>
                  {isMinimized ? (
                    <Maximize2 className='h-4 w-4' />
                  ) : (
                    <Minimize2 className='h-4 w-4' />
                  )}
                </Button>

                <Sheet open={showQueue} onOpenChange={setShowQueue}>
                  <SheetTrigger asChild>
                    <Button variant='ghost' size='sm'>
                      <List className='h-4 w-4' />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Queue</SheetTitle>
                      <SheetDescription>
                        {playlist.tracks.length} tracks • {playlist.title}
                      </SheetDescription>
                    </SheetHeader>

                    <div className='mt-6 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto'>
                      {playlist.tracks.map((track, index) => (
                        <QueueItem
                          key={track.id}
                          track={track}
                          index={index}
                          isActive={index === currentTrackIndex}
                        />
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Playback Controls */}
            <div className='flex items-center justify-center space-x-4 mb-4'>
              <Button
                variant='ghost'
                size='sm'
                onClick={toggleShuffle}
                className={isShuffleEnabled ? 'text-primary' : 'text-muted-foreground'}
              >
                <Shuffle className='h-4 w-4' />
              </Button>

              <Button variant='ghost' size='sm' onClick={playPrevious}>
                <SkipBack className='h-5 w-5' />
              </Button>

              <Button size='lg' onClick={togglePlay} className='rounded-full w-12 h-12'>
                {isPlaying ? <Pause className='h-6 w-6' /> : <Play className='h-6 w-6 ml-0.5' />}
              </Button>

              <Button variant='ghost' size='sm' onClick={playNext}>
                <SkipForward className='h-5 w-5' />
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={toggleRepeat}
                className={repeatMode !== 'none' ? 'text-primary' : 'text-muted-foreground'}
              >
                {getRepeatIcon()}
                {repeatMode === 'one' && (
                  <Badge variant='secondary' className='ml-1 h-4 w-4 p-0 text-xs'>
                    1
                  </Badge>
                )}
              </Button>
            </div>

            {/* Volume & Additional Controls */}
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <Button variant='ghost' size='sm' onClick={toggleMute}>
                  {isMuted || volume === 0 ? (
                    <VolumeX className='h-4 w-4' />
                  ) : (
                    <Volume2 className='h-4 w-4' />
                  )}
                </Button>
                <div className='w-24'>
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    step={1}
                  />
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <Button variant='ghost' size='sm'>
                  <Heart className='h-4 w-4' />
                </Button>
                <Button variant='ghost' size='sm'>
                  <Share2 className='h-4 w-4' />
                </Button>
                <Button variant='ghost' size='sm'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </div>
            </div>

            {/* Track Progress */}
            <div className='mt-2 text-center text-sm text-muted-foreground'>
              Track {currentTrackIndex + 1} of {playlist.tracks.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Playlist Info */}
      <Card className='mt-4'>
        <CardContent className='p-4'>
          <div className='flex items-center space-x-4'>
            <div className='w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center'>
              {playlist.coverImage ? (
                <img
                  src={playlist.coverImage}
                  alt={playlist.title}
                  className='w-full h-full object-cover'
                />
              ) : (
                <List className='h-8 w-8 text-muted-foreground' />
              )}
            </div>

            <div>
              <h3 className='font-semibold text-lg'>{playlist.title}</h3>
              {playlist.description && (
                <p className='text-sm text-muted-foreground line-clamp-2'>{playlist.description}</p>
              )}
              <div className='flex items-center space-x-4 mt-1 text-sm text-muted-foreground'>
                <span>{playlist.tracks.length} tracks</span>
                <span>
                  {Math.floor(
                    playlist.tracks.reduce((total, track) => total + (track.duration || 0), 0) / 60
                  )}{' '}
                  min
                </span>
                {isShuffleEnabled && <Badge variant='secondary'>Shuffle</Badge>}
                {repeatMode !== 'none' && (
                  <Badge variant='secondary'>Repeat {repeatMode === 'one' ? 'One' : 'All'}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
