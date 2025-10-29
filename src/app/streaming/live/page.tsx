'use client';

import { useState } from 'react';
import Link from 'next/link';

interface LiveStream {
  id: string;
  title: string;
  artist: string;
  avatar: string;
  thumbnail: string;
  viewers: number;
  category: string;
  isLive: boolean;
}

export default function LiveStreamingPage() {
  const [liveStreams] = useState<LiveStream[]>([
    {
      id: 'stream_1',
      title: 'Acoustic Guitar Session',
      artist: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b60b5e5d?w=150&h=150&fit=crop&crop=face',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
      viewers: 247,
      category: 'Music',
      isLive: true,
    },
    {
      id: 'stream_2',
      title: 'Behind the Scenes - Studio Recording',
      artist: 'The Indie Collective',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
      viewers: 89,
      category: 'Music',
      isLive: true,
    },
    {
      id: 'stream_3',
      title: 'Q&A with Fans',
      artist: 'Alex Rivers',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
      viewers: 156,
      category: 'Talk',
      isLive: true,
    },
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Live Streams</h1>
              <p className="mt-2 text-gray-600">Discover live content from your favorite artists</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                {liveStreams.length} Live Now
              </span>
              <Link
                href="/dashboard/artist/livestreams"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Start Streaming
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Live Streams Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreams.map((stream) => (
            <Link
              key={stream.id}
              href={`/stream/${stream.id}`}
              className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Stream Thumbnail */}
              <div className="relative">
                <img
                  src={stream.thumbnail}
                  alt={stream.title}
                  className="w-full h-48 object-cover"
                />
                {stream.isLive && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-600 text-white">
                      <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                )}
                <div className="absolute bottom-3 right-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-black/75 text-white">
                    {stream.viewers} watching
                  </span>
                </div>
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-indigo-600 ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Stream Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {stream.title}
                </h3>
                <div className="mt-2 flex items-center">
                  <img
                    src={stream.avatar}
                    alt={stream.artist}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{stream.artist}</p>
                    <p className="text-xs text-gray-500">{stream.category}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State for when no streams */}
        {liveStreams.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Live Streams</h3>
            <p className="text-gray-500 mb-6">Check back later for live content from artists</p>
            <Link
              href="/streams"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Browse All Streams
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}