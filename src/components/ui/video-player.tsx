"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/solid'
import { announceToScreenReader } from '@/lib/accessibility'

export interface VideoTrack {
  id: string
  title: string
  artist: string
  url: string
  duration?: number
  thumbnailUrl?: string
}

interface VideoPlayerProps {
  video: VideoTrack
  onPlayStateChange?: (isPlaying: boolean) => void
  className?: string
  autoPlay?: boolean
  controls?: boolean
}

export default function VideoPlayer({ 
  video, 
  onPlayStateChange,
  className = '',
  autoPlay = false,
  controls = true
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)

  // Auto-hide controls in fullscreen
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    if (isFullscreen && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isFullscreen, isPlaying])

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Video event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  const handleLoadedData = useCallback(() => {
    setIsLoading(false)
    if (videoRef.current) {
      setDuration(videoRef.current.duration || video.duration || 0)
    }
  }, [video.duration])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }, [])

  const handleWaiting = useCallback(() => {
    setIsBuffering(true)
  }, [])

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    onPlayStateChange?.(false)
  }, [onPlayStateChange])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setIsPlaying(false)
    setError('Failed to load video')
    onPlayStateChange?.(false)
  }, [onPlayStateChange])

  // Playback controls
  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return

    try {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
        onPlayStateChange?.(false)
      } else {
        await videoRef.current.play()
        setIsPlaying(true)
        onPlayStateChange?.(true)
      }
    } catch (error) {
      console.error('Playback error:', error)
      setError('Playback failed')
      setIsPlaying(false)
      onPlayStateChange?.(false)
    }
  }, [isPlaying, onPlayStateChange])

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration
    
    seekTo(newTime)
  }, [duration, seekTo])

  const changeVolume = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }, [isMuted, volume])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }, [isFullscreen])

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Handle mouse movement for control visibility
  useEffect(() => {
    const handleMouseMove = () => {
      showControlsTemporarily()
    }

    if (isFullscreen) {
      document.addEventListener('mousemove', handleMouseMove)
      return () => document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isFullscreen, showControlsTemporarily])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Auto-play handling with optimized loading
  useEffect(() => {
    if (videoRef.current) {
      // Set optimal loading attributes
      videoRef.current.preload = "auto"
      
      // Enable playsinline for mobile devices
      videoRef.current.setAttribute('playsinline', '')
      
      // Initialize duration from video prop if available
      if (video.duration && !duration) {
        setDuration(video.duration)
      }
      
      // Set optimal buffering strategy
      if ('buffered' in videoRef.current) {
        // Try to load enough of the video to ensure smooth playback
        const loadProgress = () => {
          if (videoRef.current && videoRef.current.buffered.length > 0) {
            const bufferedEnd = videoRef.current.buffered.end(0)
            const duration = videoRef.current.duration
            
            // If we've buffered less than 15 seconds ahead or less than 25% of short videos
            if (bufferedEnd < videoRef.current.currentTime + 15 && bufferedEnd / duration < 0.25) {
              // This would be where we'd adjust quality if we had an adaptive streaming setup
            }
          }
        }
        
        videoRef.current.addEventListener('progress', loadProgress)
        return () => {
          videoRef.current?.removeEventListener('progress', loadProgress)
        }
      }
      
      // Attempt autoplay if requested
      if (autoPlay) {
        videoRef.current.play().catch(() => {
          // Auto-play failed, which is expected in many browsers
        })
      }
    }
  }, [autoPlay, video.duration, duration])

  // Format time display
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Keyboard navigation for video player
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent default behavior for these keys
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'f', 'm'].includes(e.key)) {
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
      case 'f':
        toggleFullscreen();
        break;
      case 'm':
        toggleMute();
        break;
    }
  }, [togglePlayPause, seekTo, currentTime, duration, changeVolume, volume, toggleFullscreen, toggleMute]);

  // Announce status changes to screen readers
  useEffect(() => {
    let message = '';
    
    if (isLoading) {
      message = 'Video is loading';
    } else if (isBuffering) {
      message = 'Video is buffering';
    } else if (error) {
      message = `Error: ${error}`;
    } else if (isPlaying) {
      message = `Playing: ${video.title} by ${video.artist}`;
    } else {
      message = `Paused: ${video.title} by ${video.artist}`;
    }
    
    // Create or update the live region
    let liveRegion = document.getElementById('video-player-status');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'video-player-status';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = message;
  }, [isLoading, isBuffering, error, isPlaying, video.title, video.artist]);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${isFullscreen ? 'w-screen h-screen' : ''} ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isFullscreen && setShowControls(true)}
      onKeyDown={handleKeyDown}
      tabIndex={0} // Make the container focusable
      role="region"
      aria-label={`Video player: ${video.title} by ${video.artist}`}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={video.thumbnailUrl}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onError={handleError}
        onClick={togglePlayPause}
        preload="metadata"
        aria-label={`${video.title} by ${video.artist}`}
        tabIndex={-1} // Remove from tab order since container is focusable
      >
        <source src={video.url} />
        <track 
          kind="captions" 
          src={`/api/captions/${video.id}`} 
          label="English" 
          srcLang="en" 
        />
        Your browser does not support the video tag.
      </video>

      {/* Loading Spinner */}
      {(isLoading || isBuffering) && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
          role="status"
          aria-live="polite"
        >
          <div 
            className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" 
            aria-hidden="true"
          />
          <span className="sr-only">{isLoading ? 'Loading video' : 'Buffering video'}</span>
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlayPause}
            className="p-4 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Play video"
          >
            <PlayIcon className="w-12 h-12" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center text-white">
            <p className="text-lg mb-2">⚠️ Video Error</p>
            <p className="text-sm opacity-75">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {controls && (
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          role="toolbar"
          aria-label="Video controls"
        >
          {/* Progress Bar */}
          <div className="mb-4">
            <div
              ref={progressRef}
              className="w-full h-1 bg-white bg-opacity-30 rounded-full cursor-pointer"
              onClick={handleProgressClick}
              role="slider"
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  seekTo(Math.max(0, currentTime - 5));
                } else if (e.key === 'ArrowRight') {
                  seekTo(Math.min(duration, currentTime + 5));
                }
              }}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="sr-only" aria-live="polite">
              {`${formatTime(currentTime)} of ${formatTime(duration)}`}
            </div>
          </div>

          {/* Control Bar */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                disabled={isLoading || !!error}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <PauseIcon className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <PlayIcon className="w-6 h-6" aria-hidden="true" />
                )}
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-white bg-opacity-30 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={isMuted ? 0 : volume}
                  aria-valuetext={isMuted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`}
                />
              </div>

              {/* Time Display */}
              <span className="text-sm" aria-hidden="true">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Video Title */}
              <div className="text-right mr-4">
                <p className="text-sm font-medium">{video.title}</p>
                <p className="text-xs opacity-75">{video.artist}</p>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ArrowsPointingOutIcon className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          
          {/* Keyboard shortcuts help */}
          <div className="sr-only">
            <p>Keyboard shortcuts:</p>
            <ul>
              <li>Space or K: Play/Pause</li>
              <li>Left Arrow: Rewind 5 seconds</li>
              <li>Right Arrow: Forward 5 seconds</li>
              <li>Up Arrow: Increase volume</li>
              <li>Down Arrow: Decrease volume</li>
              <li>F: Toggle fullscreen</li>
              <li>M: Toggle mute</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}