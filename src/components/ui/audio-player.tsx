'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ForwardIcon,
  BackwardIcon,
} from '@heroicons/react/24/solid';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration?: number;
  thumbnailUrl?: string;
}

interface AudioPlayerProps {
  tracks: AudioTrack[];
  currentTrackIndex?: number;
  onTrackChange?: (index: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export default function AudioPlayer({
  tracks,
  currentTrackIndex = 0,
  onTrackChange,
  onPlayStateChange,
  className = '',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState(currentTrackIndex);

  const currentTrack = tracks[trackIndex];

  // Update track index when prop changes
  useEffect(() => {
    if (currentTrackIndex !== trackIndex) {
      setTrackIndex(currentTrackIndex);
    }
  }, [currentTrackIndex, trackIndex]);

  // Load new track when index changes with optimized loading
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      setIsLoading(true);
      setError(null);

      // Optimize loading by setting preload attribute
      audioRef.current.preload = 'auto';

      // Set source and load
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();

      // Prefetch next track if available
      const nextTrackIndex = trackIndex + 1;
      if (nextTrackIndex < tracks.length) {
        const nextTrack = tracks[nextTrackIndex];
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = nextTrack.url;
        prefetchLink.as = 'audio';
        document.head.appendChild(prefetchLink);

        // Clean up prefetch link when component unmounts or track changes
        return () => {
          document.head.removeChild(prefetchLink);
        };
      }
    }
  }, [currentTrack, trackIndex, tracks]);

  // Audio event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);

    // The next track handling is now managed by the MediaPlaylist component
    // which will determine the next track based on shuffle and repeat modes
    onTrackChange?.(trackIndex + 1);
  }, [trackIndex, onTrackChange, onPlayStateChange]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setIsPlaying(false);
    setError('Failed to load audio');
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  // Playback controls
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !currentTrack) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPlayStateChange?.(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlayStateChange?.(true);
      }
    } catch (error) {
      console.error('Playback error:', error);
      setError('Playback failed');
      setIsPlaying(false);
      onPlayStateChange?.(false);
    }
  }, [isPlaying, currentTrack, onPlayStateChange]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;

      seekTo(newTime);
    },
    [duration, seekTo]
  );

  const changeVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const playPrevious = useCallback(() => {
    if (trackIndex > 0) {
      const prevIndex = trackIndex - 1;
      setTrackIndex(prevIndex);
      onTrackChange?.(prevIndex);
    }
  }, [trackIndex, onTrackChange]);

  const playNext = useCallback(() => {
    if (trackIndex < tracks.length - 1) {
      const nextIndex = trackIndex + 1;
      setTrackIndex(nextIndex);
      onTrackChange?.(nextIndex);
    }
  }, [trackIndex, tracks.length, onTrackChange]);

  // Keyboard navigation for audio player
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!currentTrack) return;

      // Prevent default behavior for these keys
      if (
        ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'm', 'p', 'n'].includes(e.key)
      ) {
        e.preventDefault();
      }

      switch (e.key) {
        case ' ':
        case 'k': // YouTube-style shortcut
          togglePlayPause();
          break;
        case 'ArrowLeft':
          // Rewind 5 seconds
          seekTo(Math.max(0, currentTime - 5));
          break;
        case 'ArrowRight':
          // Forward 5 seconds
          seekTo(Math.min(duration, currentTime + 5));
          break;
        case 'ArrowUp':
          // Increase volume by 10%
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          // Decrease volume by 10%
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'p':
          if (trackIndex > 0) playPrevious();
          break;
        case 'n':
          if (trackIndex < tracks.length - 1) playNext();
          break;
      }
    },
    [
      currentTrack,
      togglePlayPause,
      seekTo,
      currentTime,
      duration,
      changeVolume,
      volume,
      toggleMute,
      playPrevious,
      playNext,
      trackIndex,
      tracks.length,
    ]
  );

  // Announce status changes to screen readers
  useEffect(() => {
    if (!currentTrack) return;

    let message = '';

    if (isLoading) {
      message = 'Audio is loading';
    } else if (error) {
      message = `Error: ${error}`;
    } else if (isPlaying) {
      message = `Playing: ${currentTrack.title} by ${currentTrack.artist}`;
    } else {
      message = `Paused: ${currentTrack.title} by ${currentTrack.artist}`;
    }

    // Create or update the live region
    let liveRegion = document.getElementById('audio-player-status');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'audio-player-status';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;
  }, [currentTrack, isLoading, error, isPlaying]);

  // Format time display
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 ${className}`}>
        <p className='text-gray-500 text-center'>No audio track available</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0} // Make the container focusable
      role='region'
      aria-label={`Audio player: ${currentTrack.title} by ${currentTrack.artist}`}
    >
      <audio
        ref={audioRef}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        preload='metadata'
      >
        <source src={currentTrack.url} type='audio/mpeg' />
        Your browser does not support the audio element.
      </audio>

      {/* Track Info */}
      <div className='p-4 border-b border-gray-100'>
        <div className='flex items-center gap-3'>
          {currentTrack.thumbnailUrl && (
            <img
              src={currentTrack.thumbnailUrl}
              alt=''
              aria-hidden='true'
              className='w-12 h-12 rounded object-cover'
            />
          )}
          <div className='flex-1 min-w-0'>
            <h4 className='font-medium text-gray-900 truncate' id='audio-track-title'>
              {currentTrack.title}
            </h4>
            <p className='text-sm text-gray-500 truncate' id='audio-track-artist'>
              {currentTrack.artist}
            </p>
          </div>
          {tracks.length > 1 && (
            <span className='text-xs text-gray-400' aria-live='polite'>
              Track {trackIndex + 1} of {tracks.length}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className='p-4'>
        {/* Progress Bar */}
        <div className='mb-4'>
          <div
            ref={progressRef}
            className='w-full h-2 bg-gray-200 rounded-full cursor-pointer'
            onClick={handleProgressClick}
            role='slider'
            aria-label='Audio progress'
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft') {
                seekTo(Math.max(0, currentTime - 5));
              } else if (e.key === 'ArrowRight') {
                seekTo(Math.min(duration, currentTime + 5));
              }
            }}
          >
            <div
              className='h-full bg-blue-600 rounded-full transition-all duration-100'
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              aria-hidden='true'
            />
          </div>
          <div className='flex justify-between text-xs text-gray-500 mt-1'>
            <span aria-hidden='true'>{formatTime(currentTime)}</span>
            <span aria-hidden='true'>{formatTime(duration)}</span>
          </div>
          <div className='sr-only' aria-live='polite'>
            {`${formatTime(currentTime)} of ${formatTime(duration)}`}
          </div>
        </div>

        {/* Control Buttons */}
        <div
          className='flex items-center justify-center gap-4'
          role='toolbar'
          aria-label='Audio controls'
        >
          {/* Previous Track */}
          <button
            onClick={playPrevious}
            disabled={trackIndex === 0 || isLoading}
            className='p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded'
            aria-label='Previous track'
          >
            <BackwardIcon className='w-5 h-5' aria-hidden='true' />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className='p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div
                className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'
                aria-hidden='true'
              />
            ) : isPlaying ? (
              <PauseIcon className='w-6 h-6' aria-hidden='true' />
            ) : (
              <PlayIcon className='w-6 h-6' aria-hidden='true' />
            )}
            <span className='sr-only'>{isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Next Track */}
          <button
            onClick={playNext}
            disabled={trackIndex === tracks.length - 1 || isLoading}
            className='p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded'
            aria-label='Next track'
          >
            <ForwardIcon className='w-5 h-5' aria-hidden='true' />
          </button>

          {/* Volume Control */}
          <div className='flex items-center gap-2 ml-4'>
            <button
              onClick={toggleMute}
              className='p-1 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded'
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <SpeakerXMarkIcon className='w-5 h-5' aria-hidden='true' />
              ) : (
                <SpeakerWaveIcon className='w-5 h-5' aria-hidden='true' />
              )}
            </button>
            <input
              type='range'
              min='0'
              max='1'
              step='0.1'
              value={isMuted ? 0 : volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              className='w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
              aria-label='Volume'
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={isMuted ? 0 : volume}
              aria-valuetext={isMuted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className='mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 text-center'
            role='alert'
            aria-live='assertive'
          >
            {error}
          </div>
        )}

        {/* Keyboard shortcuts help */}
        <div className='sr-only'>
          <p>Keyboard shortcuts:</p>
          <ul>
            <li>Space or K: Play/Pause</li>
            <li>Left Arrow: Rewind 5 seconds</li>
            <li>Right Arrow: Forward 5 seconds</li>
            <li>Up Arrow: Increase volume</li>
            <li>Down Arrow: Decrease volume</li>
            <li>M: Toggle mute</li>
            <li>P: Previous track</li>
            <li>N: Next track</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
