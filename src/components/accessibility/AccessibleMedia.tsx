'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipBack, 
  SkipForward, 
  Settings,
  ClosedCaptioning,
  FileText,
  Headphones,
  Eye,
  EyeOff,
  Download,
  RotateCcw,
  FastForward,
  Rewind,
  Loader
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader, useKeyboardNavigation, useAriaUtilities } from '@/hooks/useAccessibilityHooks';

interface MediaTrack {
  id: string;
  kind: 'captions' | 'subtitles' | 'descriptions' | 'chapters' | 'metadata';
  language: string;
  label: string;
  src?: string;
  content?: string;
  default?: boolean;
}

interface AccessibleVideoPlayerProps {
  src: string;
  title: string;
  description?: string;
  poster?: string;
  tracks?: MediaTrack[];
  transcript?: string;
  audioDescription?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

interface AccessibleAudioPlayerProps {
  src: string;
  title: string;
  artist?: string;
  description?: string;
  transcript?: string;
  waveform?: string;
  autoPlay?: boolean;
  loop?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

interface MediaControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  showFullscreen?: boolean;
  onFullscreen?: () => void;
}

// Accessible Video Player
export function AccessibleVideoPlayer({
  src,
  title,
  description,
  poster,
  tracks = [],
  transcript,
  audioDescription,
  autoPlay = false,
  controls = true,
  loop = false,
  muted = false,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  className = ''
}: AccessibleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeCaptionTrack, setActiveCaptionTrack] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useAccessibility();
  const { announce, announceLoadingStart, announceLoadingEnd } = useScreenReader();
  const { addShortcut, removeShortcut } = useKeyboardNavigation();
  const { getAriaProps } = useAriaUtilities();

  const containerId = `video-player-${title.replace(/\s+/g, '-').toLowerCase()}`;

  // Auto-pause when reduced motion is preferred
  useEffect(() => {
    if (settings.reducedMotion && isPlaying) {
      handlePause();
    }
  }, [settings.reducedMotion]);

  // Keyboard shortcuts
  useEffect(() => {
    addShortcut('space', handlePlayPause, 'Play/Pause video');
    addShortcut('k', handlePlayPause, 'Play/Pause video');
    addShortcut('m', handleMute, 'Mute/Unmute video');
    addShortcut('f', handleFullscreen, 'Toggle fullscreen');
    addShortcut('c', () => setShowTranscript(!showTranscript), 'Toggle transcript');
    addShortcut('arrowleft', () => handleSeek(currentTime - 10), 'Rewind 10 seconds');
    addShortcut('arrowright', () => handleSeek(currentTime + 10), 'Fast forward 10 seconds');

    return () => {
      removeShortcut('space');
      removeShortcut('k');
      removeShortcut('m');
      removeShortcut('f');
      removeShortcut('c');
      removeShortcut('arrowleft');
      removeShortcut('arrowright');
    };
  }, [currentTime, showTranscript]);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    announceLoadingStart('video');
  }, [announceLoadingStart]);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    setError(null);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
    announceLoadingEnd('video');
  }, [announceLoadingEnd]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setError('Failed to load video');
    announce('Error loading video', 'assertive');
  }, [announce]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      announce('Video paused');
      onPause?.();
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      announce('Video playing');
      onPlay?.();
    }
  }, [isPlaying, announce, onPlay, onPause]);

  const handleMute = useCallback(() => {
    if (!videoRef.current) return;

    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    announce(newMuted ? 'Video muted' : 'Video unmuted');
  }, [isMuted, announce]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!videoRef.current) return;

    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  }, [isMuted]);

  const handleSeek = useCallback((time: number) => {
    if (!videoRef.current) return;

    const clampedTime = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    
    const minutes = Math.floor(clampedTime / 60);
    const seconds = Math.floor(clampedTime % 60);
    announce(`Seeked to ${minutes}:${seconds.toString().padStart(2, '0')}`);
  }, [duration, announce]);

  const handleSkipBack = useCallback(() => {
    handleSeek(currentTime - 10);
  }, [currentTime, handleSeek]);

  const handleSkipForward = useCallback(() => {
    handleSeek(currentTime + 10);
  }, [currentTime, handleSeek]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
      announce('Entered fullscreen');
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
      announce('Exited fullscreen');
    }
  }, [announce]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  const handleCaptionToggle = useCallback((trackId: string) => {
    if (!videoRef.current) return;

    const textTracks = videoRef.current.textTracks;
    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      if (track.id === trackId) {
        track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
        setActiveCaptionTrack(track.mode === 'showing' ? trackId : null);
        announce(track.mode === 'showing' ? 'Captions enabled' : 'Captions disabled');
      } else {
        track.mode = 'hidden';
      }
    }
  }, [announce]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const ariaProps = getAriaProps({
    label: `${title}${description ? ` - ${description}` : ''}`,
    description: settings.descriptiveAltText ? description : undefined
  });

  return (
    <div 
      id={containerId}
      className={`bg-black rounded-lg overflow-hidden relative ${className}`}
    >
      {/* Video Element */}
      <div className="relative aspect-video bg-gray-900">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay && !settings.autoPlayDisabled}
          loop={loop}
          muted={muted}
          onLoadStart={handleLoadStart}
          onLoadedData={handleLoadedData}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
          className="w-full h-full object-contain"
          {...ariaProps}
        >
          {/* Text tracks */}
          {tracks.map(track => (
            <track
              key={track.id}
              id={track.id}
              kind={track.kind}
              src={track.src}
              srcLang={track.language}
              label={track.label}
              default={track.default}
            />
          ))}
          
          <p className="text-white p-4">
            Your browser does not support the video element.
            {transcript && (
              <>
                {' '}
                <button
                  onClick={() => setShowTranscript(true)}
                  className="underline hover:no-underline"
                >
                  View transcript
                </button>
              </>
            )}
          </p>
        </video>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <Loader className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-white text-center">
              <p className="mb-2">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  videoRef.current?.load();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Custom Controls */}
        {controls && !error && (
          <MediaControls
            isPlaying={isPlaying}
            isMuted={isMuted}
            volume={volume}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={handlePlayPause}
            onMute={handleMute}
            onVolumeChange={handleVolumeChange}
            onSeek={handleSeek}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            showFullscreen={true}
            onFullscreen={handleFullscreen}
          />
        )}

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-4 right-4 bg-black bg-opacity-90 rounded-lg p-4 text-white min-w-48"
            >
              <h3 className="font-medium mb-3">Video Settings</h3>
              
              {/* Caption Tracks */}
              {tracks.filter(t => t.kind === 'captions' || t.kind === 'subtitles').length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Captions</h4>
                  <button
                    onClick={() => handleCaptionToggle('')}
                    className={`block w-full text-left px-2 py-1 rounded text-sm ${
                      !activeCaptionTrack ? 'bg-indigo-600' : 'hover:bg-gray-700'
                    }`}
                  >
                    Off
                  </button>
                  {tracks
                    .filter(t => t.kind === 'captions' || t.kind === 'subtitles')
                    .map(track => (
                      <button
                        key={track.id}
                        onClick={() => handleCaptionToggle(track.id)}
                        className={`block w-full text-left px-2 py-1 rounded text-sm ${
                          activeCaptionTrack === track.id ? 'bg-indigo-600' : 'hover:bg-gray-700'
                        }`}
                      >
                        {track.label}
                      </button>
                    ))}
                </div>
              )}

              {/* Additional Options */}
              <div className="space-y-2">
                {transcript && (
                  <button
                    onClick={() => {
                      setShowTranscript(true);
                      setShowSettings(false);
                    }}
                    className="flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-700"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Transcript</span>
                  </button>
                )}
                
                {audioDescription && (
                  <button className="flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-700">
                    <Headphones className="w-4 h-4" />
                    <span>Audio Description</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75"
          aria-label="Video settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Modal */}
      <AnimatePresence>
        {showTranscript && transcript && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium">Video Transcript</h3>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close transcript"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-80">
                <div className="prose prose-sm max-w-none">
                  {transcript.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-2">{paragraph}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Media Controls Component
function MediaControls({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  onPlayPause,
  onMute,
  onVolumeChange,
  onSeek,
  onSkipBack,
  onSkipForward,
  showFullscreen,
  onFullscreen
}: MediaControlsProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const { settings } = useAccessibility();

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
      {/* Progress Bar */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className={`w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer ${
            settings.largeText ? 'h-3' : ''
          }`}
          style={{
            background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${progress}%, #4b5563 ${progress}%, #4b5563 100%)`
          }}
          aria-label="Video progress"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center space-x-2">
          <button
            onClick={onPlayPause}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={onSkipBack}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={onSkipForward}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {showVolumeSlider && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                aria-label="Volume"
              />
            )}
          </div>

          <span className="text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {showFullscreen && onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              aria-label="Toggle fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Accessible Audio Player
export function AccessibleAudioPlayer({
  src,
  title,
  artist,
  description,
  transcript,
  waveform,
  autoPlay = false,
  loop = false,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  className = ''
}: AccessibleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useAccessibility();
  const { announce, announceLoadingStart, announceLoadingEnd } = useScreenReader();
  const { addShortcut, removeShortcut } = useKeyboardNavigation();

  // Event handlers similar to video player...
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      announce('Audio paused');
      onPause?.();
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      announce('Audio playing');
      onPlay?.();
    }
  }, [isPlaying, announce, onPlay, onPause]);

  const handleMute = useCallback(() => {
    if (!audioRef.current) return;

    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
    announce(newMuted ? 'Audio muted' : 'Audio unmuted');
  }, [isMuted, announce]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!audioRef.current) return;

    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, []);

  const handleSeek = useCallback((time: number) => {
    if (!audioRef.current) return;

    const clampedTime = Math.max(0, Math.min(time, duration));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  const handleSkipBack = () => handleSeek(currentTime - 10);
  const handleSkipForward = () => handleSeek(currentTime + 10);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        autoPlay={autoPlay && !settings.autoPlayDisabled}
        loop={loop}
        muted={false}
        onLoadedData={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setIsLoading(false);
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const time = audioRef.current.currentTime;
            setCurrentTime(time);
            onTimeUpdate?.(time);
          }
        }}
        onEnded={onEnded}
      />

      {/* Audio Info */}
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        {artist && <p className="text-sm text-gray-600">{artist}</p>}
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>

      {/* Waveform Visualization */}
      {waveform && (
        <div className="mb-4 h-20 bg-gray-100 rounded flex items-center justify-center">
          <span className="text-gray-500 text-sm">Audio waveform visualization</span>
        </div>
      )}

      {/* Controls */}
      <MediaControls
        isPlaying={isPlaying}
        isMuted={isMuted}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onMute={handleMute}
        onVolumeChange={handleVolumeChange}
        onSeek={handleSeek}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        showFullscreen={false}
      />

      {/* Transcript Button */}
      {transcript && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowTranscript(true)}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>View Transcript</span>
          </button>
        </div>
      )}

      {/* Transcript Modal */}
      <AnimatePresence>
        {showTranscript && transcript && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium">Audio Transcript</h3>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close transcript"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-80">
                <div className="prose prose-sm max-w-none">
                  {transcript.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-2">{paragraph}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}