"use client"

import { useState, useEffect } from 'react'
import { LazyMediaPlaylist, preloadMediaComponents } from '@/components/ui/lazy-media-components'
import type { MediaItem } from '@/components/ui/media-playlist'
import { Content } from '@prisma/client'

interface ContentPlayerProps {
  content: Content | Content[]
  className?: string
}

export default function ContentPlayer({ content, className = '' }: ContentPlayerProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMediaItems = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const contentArray = Array.isArray(content) ? content : [content]
        
        // Transform content items to media items
        const items: MediaItem[] = await Promise.all(
          contentArray.map(async (item) => {
            // Get streaming URL for the content
            const streamUrl = `/api/content/${item.id}/stream`
            
            return {
              id: item.id,
              title: item.title,
              artist: item.artistName || 'Unknown Artist',
              type: item.type as 'AUDIO' | 'VIDEO',
              url: streamUrl,
              duration: item.metadata?.duration,
              thumbnailUrl: item.thumbnailUrl || undefined
            }
          })
        )
        
        setMediaItems(items)
      } catch (err) {
        console.error('Error loading media items:', err)
        setError('Failed to load media content')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMediaItems()
  }, [content])

  if (isLoading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-8 ${className}`}>
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-8 ${className}`}>
        <div className="text-center text-red-600">
          <p className="font-medium mb-2">Error loading content</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (mediaItems.length === 0) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <p>No playable content available</p>
        </div>
      </div>
    )
  }

  // Preload media components when content is available
  useEffect(() => {
    if (mediaItems.length > 0) {
      preloadMediaComponents();
    }
  }, [mediaItems]);

  return (
    <LazyMediaPlaylist 
      items={mediaItems}
      className={className}
    />
  )
}