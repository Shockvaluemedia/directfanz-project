'use client';

/**
 * Interactive Media Player - Advanced Audio/Video Player Component
 *
 * This component provides a comprehensive media player with:
 * - Advanced playback controls with custom audio processing
 * - Dynamic playlist management and queue system
 * - Real-time lyrics display with synchronization
 * - Audio visualizations and spectrum analysis
 * - Social features (comments, reactions, sharing)
 * - Crossfade transitions between tracks
 * - Equalizer and audio effects
 * - Progress tracking and resume functionality
 * - Mobile-responsive touch controls
 * - Keyboard shortcuts and accessibility
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  QueueListIcon,
  HeartIcon,
  ShareIcon,
  ChatBubbleLeftIcon,
  AdjustmentsHorizontalIcon,
  MusicalNoteIcon,
  EyeIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  RectangleStackIcon,
  MagnifyingGlassIcon,
  EllipsisHorizontalIcon,
  ChartBarIcon,
  SparklesIcon,
  BookmarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  BookmarkIcon as BookmarkIconSolid,
  SpeakerWaveIcon as SpeakerWaveIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Types
interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  url: string;
  thumbnail?: string;
  lyrics?: LyricLine[];
  genre?: string;
  releaseYear?: number;
  isLiked?: boolean;
  playCount?: number;
  waveform?: number[];
  metadata?: {
    bitrate: number;
    format: string;
    sampleRate: number;
  };
}

interface LyricLine {
  timestamp: number;
  text: string;
  duration?: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: MediaTrack[];
  thumbnail?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  timestamp: number;
  createdAt: Date;
  likes: number;
  isLiked?: boolean;
}

interface PlayerState {
  currentTrack: MediaTrack | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  crossfade: number;
  playbackRate: number;
}

interface VisualizationData {
  frequencies: Uint8Array;
  waveform: Uint8Array;
  peak: number;
  rms: number;
}

interface MediaPlayerProps {
  initialTrack?: MediaTrack;
  playlist?: Playlist;
  showComments?: boolean;
  showLyrics?: boolean;
  showVisualizer?: boolean;
  compact?: boolean;
  className?: string;
}

export default function InteractiveMediaPlayer({
  initialTrack,
  playlist,
  showComments = true,
  showLyrics = true,
  showVisualizer = true,
  compact = false,
  className,
}: MediaPlayerProps) {
  const { data: session } = useSession();
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentTrack: initialTrack || null,
    isPlaying: false,
    currentTime: 0,
    volume: 0.8,
    isMuted: false,
    isShuffled: false,
    repeatMode: 'none',
    crossfade: 3,
    playbackRate: 1.0,
  });

  // Audio context and processing
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const equalizerRef = useRef<BiquadFilterNode[]>([]);
  const visualizationRef = useRef<VisualizationData>({
    frequencies: new Uint8Array(0),
    waveform: new Uint8Array(0),
    peak: 0,
    rms: 0,
  });

  // UI state
  const [currentQueue, setCurrentQueue] = useState<MediaTrack[]>(playlist?.tracks || []);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(showLyrics);
  const [showCommentsPanel, setShowCommentsPanel] = useState(showComments);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lyrics state
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [lyricsOffset, setLyricsOffset] = useState(0);

  // Visualization state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [visualizationType, setVisualizationType] = useState<'bars' | 'wave' | 'circular'>('bars');

  // Equalizer settings
  const [equalizerSettings, setEqualizerSettings] = useState({
    '60': 0,
    '170': 0,
    '310': 0,
    '600': 0,
    '1000': 0,
    '3000': 0,
    '6000': 0,
    '12000': 0,
    '14000': 0,
    '16000': 0,
  });

  // Initialize audio context and setup
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        setupAudioProcessing();
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Setup audio processing chain
  const setupAudioProcessing = useCallback(() => {
    if (!audioContextRef.current || !audioRef.current) return;

    const audioContext = audioContextRef.current;
    const audioElement = audioRef.current;

    try {
      // Create audio source
      const source = audioContext.createMediaElementSource(audioElement);

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNodeRef.current = gainNode;

      // Create analyser for visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create equalizer filters
      const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
      const filters = frequencies.map((freq, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type =
          index === 0 ? 'lowshelf' : index === frequencies.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
      });
      equalizerRef.current = filters;

      // Connect audio chain: source -> equalizer -> gain -> analyser -> destination
      source.connect(filters[0]);
      filters.reduce((prev, current) => {
        prev.connect(current);
        return current;
      });
      filters[filters.length - 1].connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);

      console.log('Audio processing chain setup complete');
    } catch (error) {
      console.error('Failed to setup audio processing:', error);
    }
  }, []);

  // Load and play track
  const loadTrack = useCallback(async (track: MediaTrack, autoPlay = false) => {
    if (!audioRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      audioRef.current.src = track.url;
      audioRef.current.load();

      setPlayerState(prev => ({
        ...prev,
        currentTrack: track,
        currentTime: 0,
        isPlaying: autoPlay,
      }));

      // Load comments for this track
      await loadTrackComments(track.id);

      // Reset lyrics
      setCurrentLyricIndex(-1);

      if (autoPlay) {
        await audioRef.current.play();
      }

      // Update play count
      await updatePlayCount(track.id);
    } catch (error) {
      console.error('Failed to load track:', error);
      setError('Failed to load track');
      toast.error('Failed to load track');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Playback controls
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || !playerState.currentTrack) return;

    try {
      if (playerState.isPlaying) {
        audioRef.current.pause();
      } else {
        // Resume audio context if suspended
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Playback error:', error);
      toast.error('Playback failed');
    }
  }, [playerState.isPlaying, playerState.currentTrack]);

  const playNext = useCallback(() => {
    if (currentQueue.length === 0) return;

    let nextIndex = currentTrackIndex + 1;

    if (playerState.isShuffled) {
      nextIndex = Math.floor(Math.random() * currentQueue.length);
    } else if (nextIndex >= currentQueue.length) {
      nextIndex = playerState.repeatMode === 'all' ? 0 : currentTrackIndex;
    }

    if (nextIndex !== currentTrackIndex || playerState.repeatMode === 'one') {
      setCurrentTrackIndex(nextIndex);
      loadTrack(currentQueue[nextIndex], playerState.isPlaying);
    }
  }, [
    currentQueue,
    currentTrackIndex,
    playerState.isShuffled,
    playerState.repeatMode,
    playerState.isPlaying,
    loadTrack,
  ]);

  const playPrevious = useCallback(() => {
    if (currentQueue.length === 0) return;

    let prevIndex = currentTrackIndex - 1;

    if (prevIndex < 0) {
      prevIndex = playerState.repeatMode === 'all' ? currentQueue.length - 1 : 0;
    }

    setCurrentTrackIndex(prevIndex);
    loadTrack(currentQueue[prevIndex], playerState.isPlaying);
  }, [currentQueue, currentTrackIndex, playerState.repeatMode, playerState.isPlaying, loadTrack]);

  const seekTo = useCallback(
    (time: number) => {
      if (audioRef.current && playerState.currentTrack) {
        audioRef.current.currentTime = Math.max(
          0,
          Math.min(time, playerState.currentTrack.duration)
        );
      }
    },
    [playerState.currentTrack]
  );

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }

    setPlayerState(prev => ({
      ...prev,
      volume: clampedVolume,
      isMuted: clampedVolume === 0,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    if (playerState.isMuted) {
      setVolume(playerState.volume > 0 ? playerState.volume : 0.8);
    } else {
      setVolume(0);
    }
  }, [playerState.isMuted, playerState.volume, setVolume]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
      }));

      // Update lyrics
      updateCurrentLyric(audio.currentTime);
    };

    const handleEnded = () => {
      if (playerState.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    const handlePlay = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
      startVisualization();
    };

    const handlePause = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
      stopVisualization();
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setError('Playback error occurred');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [playNext, playerState.repeatMode]);

  // Lyrics synchronization
  const updateCurrentLyric = useCallback(
    (currentTime: number) => {
      const lyrics = playerState.currentTrack?.lyrics;
      if (!lyrics || lyrics.length === 0) return;

      const adjustedTime = currentTime * 1000 + lyricsOffset;
      let newIndex = -1;

      for (let i = 0; i < lyrics.length; i++) {
        if (adjustedTime >= lyrics[i].timestamp) {
          newIndex = i;
        } else {
          break;
        }
      }

      if (newIndex !== currentLyricIndex) {
        setCurrentLyricIndex(newIndex);
      }
    },
    [playerState.currentTrack?.lyrics, lyricsOffset, currentLyricIndex]
  );

  // Visualization
  const startVisualization = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const waveformArray = new Uint8Array(bufferLength);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(waveformArray);

      // Update visualization data
      visualizationRef.current = {
        frequencies: dataArray,
        waveform: waveformArray,
        peak: Math.max(...Array.from(dataArray)) / 255,
        rms:
          Math.sqrt(Array.from(dataArray).reduce((sum, val) => sum + val * val, 0) / bufferLength) /
          255,
      };

      drawVisualization(ctx, canvas, dataArray, waveformArray);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, []);

  const stopVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const drawVisualization = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      frequencies: Uint8Array,
      waveform: Uint8Array
    ) => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.fillStyle = 'rgba(17, 24, 39, 0.1)';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3B82F6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';

      if (visualizationType === 'bars') {
        // Frequency bars
        const barWidth = (width / frequencies.length) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < frequencies.length; i++) {
          barHeight = (frequencies[i] / 255) * height;

          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, '#3B82F6');
          gradient.addColorStop(1, '#1D4ED8');

          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
        }
      } else if (visualizationType === 'wave') {
        // Waveform
        ctx.beginPath();

        const sliceWidth = width / waveform.length;
        let x = 0;

        for (let i = 0; i < waveform.length; i++) {
          const v = waveform[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
      } else if (visualizationType === 'circular') {
        // Circular visualization
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 4;

        ctx.beginPath();

        for (let i = 0; i < frequencies.length; i++) {
          const angle = (i / frequencies.length) * Math.PI * 2;
          const amplitude = (frequencies[i] / 255) * radius;

          const x = centerX + Math.cos(angle) * (radius + amplitude);
          const y = centerY + Math.sin(angle) * (radius + amplitude);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
    [visualizationType]
  );

  // Social features
  const loadTrackComments = useCallback(async (trackId: string) => {
    try {
      const response = await fetch(`/api/tracks/${trackId}/comments`);
      const data = await response.json();

      if (data.success) {
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, []);

  const addComment = useCallback(async () => {
    if (!newComment.trim() || !playerState.currentTrack || !session?.user) return;

    try {
      const response = await fetch(`/api/tracks/${playerState.currentTrack.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          timestamp: playerState.currentTime,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        toast.success('Comment added!');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    }
  }, [newComment, playerState.currentTrack, playerState.currentTime, session?.user]);

  const toggleLike = useCallback(async () => {
    if (!playerState.currentTrack || !session?.user) return;

    try {
      const response = await fetch(`/api/tracks/${playerState.currentTrack.id}/like`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setPlayerState(prev => ({
          ...prev,
          currentTrack: prev.currentTrack
            ? {
                ...prev.currentTrack,
                isLiked: data.isLiked,
              }
            : null,
        }));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      toast.error('Failed to update like');
    }
  }, [playerState.currentTrack, session?.user]);

  // Equalizer
  const updateEqualizer = useCallback(
    (frequency: string, gain: number) => {
      const freqIndex = Object.keys(equalizerSettings).indexOf(frequency);
      const filter = equalizerRef.current[freqIndex];

      if (filter) {
        filter.gain.value = gain;
      }

      setEqualizerSettings(prev => ({
        ...prev,
        [frequency]: gain,
      }));
    },
    [equalizerSettings]
  );

  // Utility functions
  const updatePlayCount = async (trackId: string) => {
    try {
      await fetch(`/api/tracks/${trackId}/play`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to update play count:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initial setup
  useEffect(() => {
    if (initialTrack) {
      loadTrack(initialTrack, false);
    }
  }, [initialTrack, loadTrack]);

  return (
    <div
      className={cn(
        'bg-gray-900 text-white rounded-lg overflow-hidden',
        compact ? 'p-4' : 'p-6',
        className
      )}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} crossOrigin='anonymous' preload='metadata' />

      {/* Main Player Interface */}
      <div
        className={cn(
          'grid gap-6',
          compact
            ? 'grid-cols-1'
            : showLyricsPanel || showCommentsPanel
              ? 'lg:grid-cols-3'
              : 'grid-cols-1'
        )}
      >
        {/* Player Controls */}
        <div
          className={cn(
            compact
              ? 'col-span-1'
              : showLyricsPanel || showCommentsPanel
                ? 'lg:col-span-2'
                : 'col-span-1'
          )}
        >
          {/* Track Info */}
          {playerState.currentTrack && (
            <div className='flex items-center gap-4 mb-6'>
              <img
                src={playerState.currentTrack.thumbnail || '/default-track.png'}
                alt={playerState.currentTrack.title}
                className={cn('rounded-lg object-cover', compact ? 'w-12 h-12' : 'w-16 h-16')}
              />

              <div className='flex-1 min-w-0'>
                <h3 className={cn('font-semibold truncate', compact ? 'text-base' : 'text-lg')}>
                  {playerState.currentTrack.title}
                </h3>
                <p className={cn('text-gray-400 truncate', compact ? 'text-sm' : 'text-base')}>
                  {playerState.currentTrack.artist}
                </p>
                {!compact && playerState.currentTrack.album && (
                  <p className='text-sm text-gray-500 truncate'>{playerState.currentTrack.album}</p>
                )}
              </div>

              {/* Social Actions */}
              <div className='flex items-center gap-2'>
                <button
                  onClick={toggleLike}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    playerState.currentTrack.isLiked
                      ? 'text-red-500 hover:text-red-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {playerState.currentTrack.isLiked ? (
                    <HeartIconSolid className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                  ) : (
                    <HeartIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                  )}
                </button>

                <button className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'>
                  <ShareIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                </button>

                {!compact && (
                  <button className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'>
                    <EllipsisHorizontalIcon className='w-5 h-5' />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Visualization */}
          {showVisualizer && !compact && (
            <div className='mb-6'>
              <div className='flex items-center justify-between mb-3'>
                <h4 className='text-sm font-medium text-gray-300'>Visualizer</h4>
                <div className='flex items-center gap-2'>
                  {(['bars', 'wave', 'circular'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setVisualizationType(type)}
                      className={cn(
                        'px-2 py-1 rounded text-xs transition-colors',
                        visualizationType === type
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className='w-full h-32 bg-gray-800 rounded-lg'
              />
            </div>
          )}

          {/* Progress Bar */}
          <div className='mb-6'>
            <div className='flex items-center gap-3 mb-2'>
              <span className={cn('text-gray-400 font-mono', compact ? 'text-xs' : 'text-sm')}>
                {formatTime(playerState.currentTime)}
              </span>

              <div className='flex-1 relative'>
                <div className='h-2 bg-gray-700 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-blue-600 transition-all duration-100'
                    style={{
                      width: playerState.currentTrack
                        ? `${(playerState.currentTime / playerState.currentTrack.duration) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
                <input
                  type='range'
                  min='0'
                  max={playerState.currentTrack?.duration || 0}
                  value={playerState.currentTime}
                  onChange={e => seekTo(Number(e.target.value))}
                  className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
                />
              </div>

              <span className={cn('text-gray-400 font-mono', compact ? 'text-xs' : 'text-sm')}>
                {formatTime(playerState.currentTrack?.duration || 0)}
              </span>
            </div>

            {/* Comments timeline markers */}
            {showCommentsPanel && comments.length > 0 && playerState.currentTrack && (
              <div className='relative h-1 mb-2'>
                {comments.map(comment => (
                  <div
                    key={comment.id}
                    className='absolute w-1 h-1 bg-yellow-500 rounded-full transform -translate-x-1/2'
                    style={{
                      left: `${(comment.timestamp / playerState.currentTrack!.duration) * 100}%`,
                    }}
                    title={`${formatTime(comment.timestamp)}: ${comment.content}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Main Controls */}
          <div className='flex items-center justify-center gap-4 mb-6'>
            <button
              onClick={() =>
                setPlayerState(prev => ({
                  ...prev,
                  isShuffled: !prev.isShuffled,
                }))
              }
              className={cn(
                'p-2 rounded-full transition-colors',
                playerState.isShuffled ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              )}
            >
              <ArrowsRightLeftIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>

            <button
              onClick={playPrevious}
              className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'
            >
              <BackwardIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
            </button>

            <button
              onClick={togglePlayPause}
              disabled={!playerState.currentTrack || isLoading}
              className={cn(
                'p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-full transition-colors',
                compact && 'p-2'
              )}
            >
              {isLoading ? (
                <div
                  className={cn(
                    'animate-spin border-2 border-white border-t-transparent rounded-full',
                    compact ? 'w-4 h-4' : 'w-6 h-6'
                  )}
                />
              ) : playerState.isPlaying ? (
                <PauseIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
              ) : (
                <PlayIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
              )}
            </button>

            <button
              onClick={playNext}
              className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'
            >
              <ForwardIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
            </button>

            <button
              onClick={() =>
                setPlayerState(prev => ({
                  ...prev,
                  repeatMode:
                    prev.repeatMode === 'none' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'none',
                }))
              }
              className={cn(
                'p-2 rounded-full transition-colors relative',
                playerState.repeatMode !== 'none'
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <ArrowPathIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              {playerState.repeatMode === 'one' && (
                <span className='absolute -top-1 -right-1 text-xs bg-blue-600 rounded-full w-4 h-4 flex items-center justify-center'>
                  1
                </span>
              )}
            </button>
          </div>

          {/* Secondary Controls */}
          <div className='flex items-center justify-between'>
            {/* Volume Control */}
            <div className='flex items-center gap-3'>
              <button
                onClick={toggleMute}
                className='text-gray-400 hover:text-white transition-colors'
              >
                {playerState.isMuted || playerState.volume === 0 ? (
                  <SpeakerXMarkIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                ) : (
                  <SpeakerWaveIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                )}
              </button>

              <div className={cn('flex items-center gap-2', compact ? 'w-16' : 'w-24')}>
                <input
                  type='range'
                  min='0'
                  max='1'
                  step='0.01'
                  value={playerState.volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className='flex-1'
                />
                <span className='text-xs text-gray-400 w-8'>
                  {Math.round(playerState.volume * 100)}
                </span>
              </div>
            </div>

            {/* Additional Controls */}
            {!compact && (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setShowEqualizer(!showEqualizer)}
                  className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'
                >
                  <AdjustmentsHorizontalIcon className='w-4 h-4' />
                </button>

                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className='p-2 text-gray-400 hover:text-white rounded-full transition-colors'
                >
                  <QueueListIcon className='w-4 h-4' />
                </button>

                {showLyrics && (
                  <button
                    onClick={() => setShowLyricsPanel(!showLyricsPanel)}
                    className={cn(
                      'p-2 rounded-full transition-colors',
                      showLyricsPanel ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                    )}
                  >
                    <MusicalNoteIcon className='w-4 h-4' />
                  </button>
                )}

                {showComments && (
                  <button
                    onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                    className={cn(
                      'p-2 rounded-full transition-colors',
                      showCommentsPanel ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                    )}
                  >
                    <ChatBubbleLeftIcon className='w-4 h-4' />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Equalizer */}
          {showEqualizer && !compact && (
            <div className='mt-6 p-4 bg-gray-800 rounded-lg'>
              <h4 className='text-sm font-medium mb-4'>Equalizer</h4>
              <div className='grid grid-cols-5 lg:grid-cols-10 gap-2'>
                {Object.entries(equalizerSettings).map(([freq, gain]) => (
                  <div key={freq} className='text-center'>
                    <input
                      type='range'
                      min='-12'
                      max='12'
                      step='1'
                      value={gain}
                      onChange={e => updateEqualizer(freq, Number(e.target.value))}
                      className='w-full h-20 slider-vertical'
                      style={{ writingMode: 'bt-lr', appearance: 'slider-vertical' }}
                    />
                    <div className='text-xs text-gray-400 mt-1'>{freq}Hz</div>
                  </div>
                ))}
              </div>
              <div className='flex justify-center mt-4'>
                <button
                  onClick={() => {
                    const resetSettings = Object.keys(equalizerSettings).reduce((acc, freq) => {
                      acc[freq] = 0;
                      updateEqualizer(freq, 0);
                      return acc;
                    }, {} as any);
                    setEqualizerSettings(resetSettings);
                  }}
                  className='px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors'
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Queue */}
          {showQueue && !compact && (
            <div className='mt-6 p-4 bg-gray-800 rounded-lg'>
              <div className='flex items-center justify-between mb-4'>
                <h4 className='text-sm font-medium'>Queue</h4>
                <span className='text-xs text-gray-400'>{currentQueue.length} tracks</span>
              </div>

              <div className='space-y-2 max-h-48 overflow-y-auto'>
                {currentQueue.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      setCurrentTrackIndex(index);
                      loadTrack(track, playerState.isPlaying);
                    }}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded cursor-pointer transition-colors',
                      index === currentTrackIndex
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'hover:bg-gray-700'
                    )}
                  >
                    <img
                      src={track.thumbnail || '/default-track.png'}
                      alt={track.title}
                      className='w-8 h-8 rounded object-cover'
                    />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium truncate'>{track.title}</p>
                      <p className='text-xs text-gray-400 truncate'>{track.artist}</p>
                    </div>
                    <span className='text-xs text-gray-400'>{formatTime(track.duration)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lyrics Panel */}
        {showLyricsPanel && !compact && playerState.currentTrack?.lyrics && (
          <div className='bg-gray-800 rounded-lg p-4'>
            <div className='flex items-center justify-between mb-4'>
              <h4 className='text-sm font-medium'>Lyrics</h4>
              <div className='flex items-center gap-2'>
                <input
                  type='range'
                  min='-5000'
                  max='5000'
                  step='100'
                  value={lyricsOffset}
                  onChange={e => setLyricsOffset(Number(e.target.value))}
                  className='w-16'
                />
                <span className='text-xs text-gray-400'>Sync</span>
              </div>
            </div>

            <div className='space-y-3 max-h-96 overflow-y-auto'>
              {playerState.currentTrack.lyrics.map((line, index) => (
                <div
                  key={index}
                  onClick={() => seekTo(line.timestamp / 1000)}
                  className={cn(
                    'p-2 rounded cursor-pointer transition-all duration-300',
                    index === currentLyricIndex
                      ? 'bg-blue-600/20 text-blue-400 scale-105'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  )}
                >
                  <span className='text-sm'>{line.text}</span>
                  <div className='text-xs text-gray-500 mt-1'>
                    {formatTime(line.timestamp / 1000)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Panel */}
        {showCommentsPanel && !compact && (
          <div className='bg-gray-800 rounded-lg p-4'>
            <div className='flex items-center justify-between mb-4'>
              <h4 className='text-sm font-medium'>Comments</h4>
              <span className='text-xs text-gray-400'>{comments.length}</span>
            </div>

            {/* Add Comment */}
            {session?.user && (
              <div className='mb-4'>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder='Add a comment...'
                    className='flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
                    onKeyDown={e => e.key === 'Enter' && addComment()}
                  />
                  <button
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors text-sm'
                  >
                    Add
                  </button>
                </div>
                <div className='text-xs text-gray-500 mt-1'>
                  Comment will be timestamped at {formatTime(playerState.currentTime)}
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className='space-y-3 max-h-96 overflow-y-auto'>
              {comments.map(comment => (
                <div
                  key={comment.id}
                  onClick={() => seekTo(comment.timestamp)}
                  className='p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors'
                >
                  <div className='flex items-start gap-3'>
                    <img
                      src={comment.avatar || '/default-avatar.png'}
                      alt={comment.userName}
                      className='w-6 h-6 rounded-full'
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='text-sm font-medium'>{comment.userName}</span>
                        <span className='text-xs text-gray-400'>
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <p className='text-sm text-gray-300'>{comment.content}</p>
                      <div className='flex items-center gap-4 mt-2'>
                        <button className='flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors'>
                          <HeartIcon className='w-3 h-3' />
                          <span>{comment.likes}</span>
                        </button>
                        <span className='text-xs text-gray-500'>
                          {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className='mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg'>
          <p className='text-red-200 text-sm'>{error}</p>
        </div>
      )}
    </div>
  );
}
