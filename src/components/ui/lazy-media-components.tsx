'use client';

import React, { useState, useEffect } from 'react';
import { useIntersectionObserver, useLazyImage } from '@/lib/lazy-load';
import VideoPlayer, { VideoTrack } from './video-player';
import AudioPlayer, { AudioTrack } from './audio-player';
import MediaPlaylist, { MediaItem } from './media-playlist';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderSrc?: string;
  fallbackSrc?: string;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * LazyImage component that loads images only when they enter the viewport
 */
export function LazyImage({
  src,
  alt,
  placeholderSrc,
  fallbackSrc,
  className = '',
  width,
  height,
  ...props
}: LazyImageProps) {
  const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>();
  const [imgSrc, isLoaded, onLoad] = useLazyImage(src, placeholderSrc);
  const [error, setError] = useState(false);

  // Handle image load error
  const handleError = () => {
    setError(true);
    if (fallbackSrc) {
      // Use fallback image if provided
      const img = new Image();
      img.src = fallbackSrc;
    }
  };

  // Determine which source to use
  const displaySrc = error && fallbackSrc ? fallbackSrc : imgSrc;

  // Determine loading attribute based on visibility
  const loadingAttr = isVisible ? undefined : 'lazy';

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto' }}
    >
      {/* Placeholder or loading state */}
      {!isLoaded && !error && (
        <div className='absolute inset-0 bg-gray-200 animate-pulse' aria-hidden='true' />
      )}

      {/* Actual image */}
      <img
        src={isVisible ? displaySrc : placeholderSrc || ''}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={onLoad}
        onError={handleError}
        loading={loadingAttr}
        width={width}
        height={height}
        {...props}
      />

      {/* Error state */}
      {error && !fallbackSrc && (
        <div className='absolute inset-0 flex items-center justify-center bg-gray-100'>
          <span className='text-gray-500 text-sm'>Image failed to load</span>
        </div>
      )}
    </div>
  );
}

interface LazyVideoPlayerProps {
  video: VideoTrack;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  placeholderSrc?: string;
}

/**
 * LazyVideoPlayer component that loads video player only when it enters the viewport
 */
export function LazyVideoPlayer({
  video,
  onPlayStateChange,
  className = '',
  autoPlay = false,
  controls = true,
  placeholderSrc,
}: LazyVideoPlayerProps) {
  const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>();
  const [isLoaded, setIsLoaded] = useState(false);

  // Load video player when it becomes visible
  useEffect(() => {
    if (isVisible && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isVisible, isLoaded]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ minHeight: '200px' }}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <div className='absolute inset-0 bg-black flex items-center justify-center'>
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt={`Thumbnail for ${video.title}`}
              className='w-full h-full object-contain'
            />
          ) : (
            <div className='text-white text-center p-4'>
              <p className='font-medium'>{video.title}</p>
              <p className='text-sm opacity-75'>{video.artist}</p>
              <button
                className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                onClick={() => setIsLoaded(true)}
                aria-label={`Load video: ${video.title}`}
              >
                Load Video
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video player */}
      {(isLoaded || autoPlay) && (
        <VideoPlayer
          video={video}
          onPlayStateChange={onPlayStateChange}
          className={className}
          autoPlay={autoPlay && isVisible}
          controls={controls}
        />
      )}
    </div>
  );
}

interface LazyAudioPlayerProps {
  tracks: AudioTrack[];
  currentTrackIndex?: number;
  onTrackChange?: (index: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

/**
 * LazyAudioPlayer component that loads audio player only when it enters the viewport
 */
export function LazyAudioPlayer({
  tracks,
  currentTrackIndex = 0,
  onTrackChange,
  onPlayStateChange,
  className = '',
}: LazyAudioPlayerProps) {
  const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>();
  const [isLoaded, setIsLoaded] = useState(false);

  // Load audio player when it becomes visible
  useEffect(() => {
    if (isVisible && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isVisible, isLoaded]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder */}
      {!isLoaded && (
        <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
          <div className='flex items-center gap-3'>
            {tracks[currentTrackIndex]?.thumbnailUrl && (
              <div className='w-12 h-12 bg-gray-200 rounded' />
            )}
            <div className='flex-1'>
              <div className='h-5 bg-gray-200 rounded w-3/4 mb-2' />
              <div className='h-4 bg-gray-200 rounded w-1/2' />
            </div>
          </div>
          <div className='mt-4 flex justify-center'>
            <button
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              onClick={() => setIsLoaded(true)}
              aria-label={`Load audio: ${tracks[currentTrackIndex]?.title}`}
            >
              Load Audio Player
            </button>
          </div>
        </div>
      )}

      {/* Audio player */}
      {isLoaded && (
        <AudioPlayer
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          onTrackChange={onTrackChange}
          onPlayStateChange={onPlayStateChange}
          className={className}
        />
      )}
    </div>
  );
}

interface LazyMediaPlaylistProps {
  items: MediaItem[];
  autoPlay?: boolean;
  className?: string;
}

/**
 * LazyMediaPlaylist component that loads media playlist only when it enters the viewport
 */
export function LazyMediaPlaylist({
  items,
  autoPlay = false,
  className = '',
}: LazyMediaPlaylistProps) {
  const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>();
  const [isLoaded, setIsLoaded] = useState(false);

  // Load media playlist when it becomes visible
  useEffect(() => {
    if (isVisible && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isVisible, isLoaded]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ minHeight: '150px' }}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-6'>
          <div className='flex items-center justify-center h-32'>
            <div className='text-center'>
              <div className='w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center'>
                <svg className='w-8 h-8 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
                  <path d='M18 3a1 1 0 00-1.196-.98L7 3.25a1 1 0 00-.804.98V6c-1.036 0-2 .82-2 1.833v2.334C4.196 11.18 5.16 12 6.196 12H7v4a1 1 0 001.196.98l9.804-1.23A1 1 0 0019 14.75V4a1 1 0 00-1-1z' />
                </svg>
              </div>
              <p className='text-gray-600 font-medium'>Media Playlist</p>
              <p className='text-sm text-gray-500 mt-1'>{items.length} items</p>
              <button
                className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                onClick={() => setIsLoaded(true)}
                aria-label='Load media playlist'
              >
                Load Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media playlist */}
      {isLoaded && (
        <MediaPlaylist items={items} autoPlay={autoPlay && isVisible} className={className} />
      )}
    </div>
  );
}

/**
 * Preload media components to improve performance
 */
export function preloadMediaComponents() {
  // This function can be used to preload heavy media components
  // Currently just returns a resolved promise, but could be extended to:
  // - Preload video/audio codecs
  // - Warm up media processing libraries
  // - Cache commonly used media assets
  return Promise.resolve();
}
