'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FireIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Artist {
  id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  artists?: {
    genre?: string;
    tags?: string[];
  };
  tiers?: Array<{
    id: string;
    minimumPrice: number;
  }>;
  subscriptions?: Array<{ id: string }>;
  recommendationReason?: string;
  trendingStats?: {
    newSubscribers: number;
    growthPercent: number;
  };
  newArtistStats?: {
    joinedDaysAgo: number;
    contentCount: number;
  };
}

export default function DiscoveryPage() {
  const [recommended, setRecommended] = useState<Artist[]>([]);
  const [trending, setTrending] = useState<Artist[]>([]);
  const [newArtists, setNewArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscoveryData();
  }, []);

  async function fetchDiscoveryData() {
    setLoading(true);

    try {
      // Fetch all discovery sections in parallel
      const [recommendedRes, trendingRes, newRes] = await Promise.all([
        fetch('/api/discovery/recommended?limit=12'),
        fetch('/api/discovery/trending?limit=12'),
        fetch('/api/discovery/new?limit=12'),
      ]);

      if (recommendedRes.ok) {
        const data = await recommendedRes.json();
        setRecommended(data.artists || []);
      }

      if (trendingRes.ok) {
        const data = await trendingRes.json();
        setTrending(data.artists || []);
      }

      if (newRes.ok) {
        const data = await newRes.json();
        setNewArtists(data.artists || []);
      }
    } catch (error) {
      console.error('Failed to fetch discovery data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function trackInteraction(artistId: string, type: string) {
    try {
      await fetch('/api/analytics/track-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionType: type,
          targetType: 'ARTIST',
          targetId: artistId,
        }),
      });
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading discovery feed...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Discover Artists
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find creators you'll love and support their work
        </p>
      </div>

      {/* Recommended for You */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Recommended for You
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recommended.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                badge={artist.recommendationReason}
                onView={() => trackInteraction(artist.id, 'VIEW')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending Now */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FireIcon className="w-7 h-7 text-orange-600 dark:text-orange-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Trending Now
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {trending.map((artist, index) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                badge={
                  artist.trendingStats
                    ? `+${artist.trendingStats.growthPercent}% growth`
                    : 'Trending'
                }
                rank={index + 1}
                onView={() => trackInteraction(artist.id, 'VIEW')}
              />
            ))}
          </div>
        </section>
      )}

      {/* New & Noteworthy */}
      {newArtists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <StarIcon className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                New & Noteworthy
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {newArtists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                badge={
                  artist.newArtistStats
                    ? `Joined ${artist.newArtistStats.joinedDaysAgo}d ago`
                    : 'New Artist'
                }
                onView={() => trackInteraction(artist.id, 'VIEW')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface ArtistCardProps {
  artist: Artist;
  badge?: string;
  rank?: number;
  onView: () => void;
}

function ArtistCard({ artist, badge, rank, onView }: ArtistCardProps) {
  const lowestTierPrice = artist.tiers?.[0]?.minimumPrice;
  const subscriberCount = artist.subscriptions?.length || 0;
  const genre = artist.artists?.genre;

  return (
    <Link
      href={`/artist/${artist.id}`}
      onClick={onView}
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
      >
        {/* Avatar */}
        <div className="relative aspect-square bg-gradient-to-br from-indigo-500 to-purple-600">
          {artist.avatar ? (
            <img
              src={artist.avatar}
              alt={artist.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <UsersIcon className="w-20 h-20 text-white/50" />
            </div>
          )}

          {/* Rank Badge */}
          {rank && (
            <div className="absolute top-3 left-3 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">#{rank}</span>
            </div>
          )}

          {/* Badge */}
          {badge && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white text-center truncate">
                {badge}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate mb-1">
            {artist.displayName}
          </h3>

          {genre && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {genre}
            </p>
          )}

          {artist.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
              {artist.bio}
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <UsersIcon className="w-4 h-4" />
              <span>{subscriberCount} fans</span>
            </div>

            {lowestTierPrice && (
              <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                From ${lowestTierPrice}/mo
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
