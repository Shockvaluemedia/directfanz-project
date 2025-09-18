"use client"

import { useState, useCallback, useEffect } from 'react'
import { 
  MusicalNoteIcon, 
  VideoCameraIcon, 
  PlayIcon, 
  PauseIcon,
  ArrowPathRoundedSquareIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/solid'
import AudioPlayer, { AudioTrack } from './audio-player'
import VideoPlayer, { VideoTrack } from './video-player'

export interface MediaItem {
  id: string
  title: string
  artist: string
  type: 'AUDIO' | 'VIDEO'
  url: string
  duration?: number
  thumbnailUrl?: string
}

interface MediaPlaylistProps {
  items: MediaItem[]
  autoPlay?: boolean
  className?: string
}

export default function MediaPlaylist({ 
  items, 
  autoPlay = false, 
  className = '' 
}: MediaPlaylistProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(true)
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none')
  const [shuffleMode, setShuffleMode] = useState(false)
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])

  // Generate shuffle order when items change or shuffle mode is enabled
  useEffect(() => {
    if (shuffleMode && items.length > 0) {
      // Create a shuffled array of indices
      const indices = Array.from({ length: items.length }, (_, i) => i)
      
      // Fisher-Yates shuffle algorithm using crypto.getRandomValues
      for (let i = indices.length - 1; i > 0; i--) {
        const randomArray = new Uint32Array(1)
        crypto.getRandomValues(randomArray)
        const j = Math.floor((randomArray[0] / (0xFFFFFFFF + 1)) * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      
      // Ensure current playing item is first in shuffle
      if (currentIndex !== undefined) {
        const currentPos = indices.indexOf(currentIndex)
        if (currentPos > 0) {
          indices.splice(currentPos, 1)
          indices.unshift(currentIndex)
        }
      }
      
      setShuffleOrder(indices)
    }
  }, [shuffleMode, items.length, currentIndex])

  // Get the current item based on normal or shuffle mode
  const currentItem = items[currentIndex]
  
  // Separate audio and video items
  const audioTracks: AudioTrack[] = items
    .filter(item => item.type === 'AUDIO')
    .map(item => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      url: item.url,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl
    }))

  const videoTracks: VideoTrack[] = items
    .filter(item => item.type === 'VIDEO')
    .map(item => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      url: item.url,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl
    }))

  const handleTrackSelect = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing)
  }, [])
  
  const toggleShuffle = useCallback(() => {
    setShuffleMode(prev => !prev)
  }, [])
  
  const toggleRepeat = useCallback(() => {
    setRepeatMode(current => {
      if (current === 'none') return 'all'
      if (current === 'all') return 'one'
      return 'none'
    })
  }, [])
  
  const getNextTrackIndex = useCallback(() => {
    if (items.length <= 1) return currentIndex
    
    if (repeatMode === 'one') {
      return currentIndex
    }
    
    if (shuffleMode) {
      const currentShuffleIndex = shuffleOrder.indexOf(currentIndex)
      if (currentShuffleIndex < shuffleOrder.length - 1) {
        return shuffleOrder[currentShuffleIndex + 1]
      } else if (repeatMode === 'all') {
        return shuffleOrder[0]
      }
    } else {
      if (currentIndex < items.length - 1) {
        return currentIndex + 1
      } else if (repeatMode === 'all') {
        return 0
      }
    }
    
    return currentIndex
  }, [currentIndex, items.length, repeatMode, shuffleMode, shuffleOrder])
  
  const getPrevTrackIndex = useCallback(() => {
    if (items.length <= 1) return currentIndex
    
    if (repeatMode === 'one') {
      return currentIndex
    }
    
    if (shuffleMode) {
      const currentShuffleIndex = shuffleOrder.indexOf(currentIndex)
      if (currentShuffleIndex > 0) {
        return shuffleOrder[currentShuffleIndex - 1]
      } else if (repeatMode === 'all') {
        return shuffleOrder[shuffleOrder.length - 1]
      }
    } else {
      if (currentIndex > 0) {
        return currentIndex - 1
      } else if (repeatMode === 'all') {
        return items.length - 1
      }
    }
    
    return currentIndex
  }, [currentIndex, items.length, repeatMode, shuffleMode, shuffleOrder])

  const formatDuration = (duration?: number) => {
    if (!duration) return ''
    
    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getItemIcon = (type: string) => {
    return type === 'AUDIO' ? MusicalNoteIcon : VideoCameraIcon
  }

  if (items.length === 0) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <p className="text-gray-500">No media items available</p>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Media Player */}
      <div className="relative">
        {currentItem?.type === 'AUDIO' ? (
          <AudioPlayer
            tracks={audioTracks}
            currentTrackIndex={audioTracks.findIndex(track => track.id === currentItem.id)}
            onTrackChange={(index) => {
              const audioTrack = audioTracks[index]
              const itemIndex = items.findIndex(item => item.id === audioTrack.id)
              setCurrentIndex(itemIndex)
            }}
            onPlayStateChange={handlePlayStateChange}
          />
        ) : currentItem?.type === 'VIDEO' ? (
          <VideoPlayer
            video={videoTracks.find(track => track.id === currentItem.id)!}
            onPlayStateChange={handlePlayStateChange}
            autoPlay={autoPlay}
          />
        ) : (
          <div className="bg-gray-100 p-8 text-center">
            <p className="text-gray-500">Unsupported media type</p>
          </div>
        )}
      </div>

      {/* Playlist Toggle */}
      {items.length > 1 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="w-full p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
          >
            <span>Playlist ({items.length} items)</span>
            <span className={`transform transition-transform ${showPlaylist ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      )}

      {/* Playlist */}
      {showPlaylist && items.length > 1 && (
        <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
          {items.map((item, index) => {
            const Icon = getItemIcon(item.type)
            const isCurrentItem = index === currentIndex
            const isCurrentlyPlaying = isCurrentItem && isPlaying

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                  isCurrentItem 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleTrackSelect(index)}
              >
                {/* Thumbnail or Icon */}
                <div className="w-12 h-12 flex-shrink-0 relative">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Play/Pause Overlay */}
                  {isCurrentItem && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                      {isCurrentlyPlaying ? (
                        <PauseIcon className="w-4 h-4 text-white" />
                      ) : (
                        <PlayIcon className="w-4 h-4 text-white" />
                      )}
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${
                    isCurrentItem ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {item.title}
                  </h4>
                  <p className={`text-sm truncate ${
                    isCurrentItem ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {item.artist}
                  </p>
                </div>

                {/* Duration and Type */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-xs uppercase font-medium ${
                    isCurrentItem ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {item.type}
                  </div>
                  {item.duration && (
                    <div className={`text-xs ${
                      isCurrentItem ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {formatDuration(item.duration)}
                    </div>
                  )}
                </div>

                {/* Track Number */}
                <div className={`text-xs font-medium w-6 text-center ${
                  isCurrentItem ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {index + 1}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Playlist Controls */}
      {items.length > 1 && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Shuffle Button */}
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-full ${
                  shuffleMode 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                aria-label={shuffleMode ? 'Disable shuffle' : 'Enable shuffle'}
                title={shuffleMode ? 'Disable shuffle' : 'Enable shuffle'}
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
              </button>
              
              {/* Repeat Button */}
              <button
                onClick={toggleRepeat}
                className={`p-2 rounded-full relative ${
                  repeatMode !== 'none'
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                aria-label={`Repeat mode: ${repeatMode}`}
                title={`Repeat mode: ${repeatMode}`}
              >
                <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                {repeatMode === 'one' && (
                  <span className="absolute -bottom-1 -right-1 text-[10px] bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {audioTracks.length} audio, {videoTracks.length} video
              </span>
              <span className="ml-3">
                Total: {items.reduce((acc, item) => acc + (item.duration || 0), 0) > 0 
                  ? formatDuration(items.reduce((acc, item) => acc + (item.duration || 0), 0))
                  : 'Unknown duration'
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}