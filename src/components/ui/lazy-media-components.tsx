'use client';

import React, { useState, useEffect } from 'react';
import { useIntersectionObserver, useLazyImage } from '@/lib/lazy-load';
import VideoPlayer, { VideoTrack } from './video-player';
import AudioPlayer, { AudioTrack } from './audio-player';

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
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          aria-hidden="true"
        />
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500 text-sm">Image failed to load</span>
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
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {placeholderSrc ? (
            <img 
              src={placeholderSrc} 
              alt={`Thumbnail for ${video.title}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-white text-center p-4">
              <p className="font-medium">{video.title}</p>
              <p className="text-sm opacity-75">{video.artist}</p>
              <button 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
    <div 
      ref={ref} 
      className={`relative overflow-hidden ${className}`}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            {tracks[currentTrackIndex]?.thumbnailUrl && (
              <div className="w-12 h-12 bg-gray-200 rounded" />
            )}
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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