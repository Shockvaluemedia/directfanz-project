'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Tier {
  id: string;
  name: string;
  description: string;
  minimumPrice: string;
  subscriberCount: number;
}

interface Content {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  tags: string[];
}

interface ExistingSubscription {
  id: string;
  tierId: string;
  amount: string;
  status: string;
  currentPeriodEnd: string;
  tier: {
    name: string;
  };
}

interface Artist {
  id: string;
  displayName: string;
  bio: string | null;
  avatar: string | null;
  socialLinks: any;
  createdAt: string;
  artists: {
    totalSubscribers: number;
    isStripeOnboarded: boolean;
  } | null;
  tiers: Tier[];
  content: Content[];
}

interface ArtistProfileProps {
  artist: Artist;
  existingSubscriptions: ExistingSubscription[];
}

export default function ArtistProfile({ artist, existingSubscriptions }: ArtistProfileProps) {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(price));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isSubscribedToTier = (tierId: string) => {
    return existingSubscriptions.some(sub => sub.tierId === tierId);
  };

  const handleSubscribe = async (tier: Tier) => {
    if (isSubscribedToTier(tier.id)) {
      return; // Already subscribed
    }

    const amount = customAmount ? parseFloat(customAmount) : parseFloat(tier.minimumPrice);

    if (amount < parseFloat(tier.minimumPrice)) {
      alert(`Amount must be at least ${formatPrice(tier.minimumPrice)}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tierId: tier.id,
          amount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Subscription error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start subscription');
    } finally {
      setLoading(false);
    }
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return '🐦';
      case 'instagram':
        return '📷';
      case 'youtube':
        return '📺';
      case 'spotify':
        return '🎵';
      case 'soundcloud':
        return '🎧';
      default:
        return '🔗';
    }
  };

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      {/* Artist Header */}
      <div className='bg-white rounded-lg shadow-md overflow-hidden mb-8'>
        <div className='md:flex'>
          {/* Artist Avatar */}
          <div className='md:w-1/3'>
            <div className='aspect-square relative bg-gray-200'>
              {artist.avatar ? (
                <Image src={artist.avatar} alt={artist.displayName} fill className='object-cover' />
              ) : (
                <div className='w-full h-full flex items-center justify-center'>
                  <div className='w-32 h-32 bg-gray-400 rounded-full flex items-center justify-center'>
                    <span className='text-4xl font-bold text-white'>
                      {artist.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Artist Info */}
          <div className='md:w-2/3 p-6'>
            <h1 className='text-3xl font-bold text-gray-900 mb-4'>{artist.displayName}</h1>

            {artist.bio && <p className='text-gray-600 mb-4 leading-relaxed'>{artist.bio}</p>}

            {/* Stats */}
            <div className='flex gap-6 mb-4 text-sm text-gray-500'>
              <span>{artist.artists?.totalSubscribers || 0} subscribers</span>
              <span>Joined {formatDate(artist.createdAt)}</span>
              <span>{artist.content.length} public releases</span>
            </div>

            {/* Social Links */}
            {artist.socialLinks && Object.keys(artist.socialLinks).length > 0 && (
              <div className='flex gap-3'>
                {Object.entries(artist.socialLinks).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url as string}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200 transition-colors'
                  >
                    <span>{getSocialIcon(platform)}</span>
                    <span className='capitalize'>{platform}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Subscription Tiers */}
        <div className='lg:col-span-2'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6'>Support {artist.displayName}</h2>

          {/* Existing Subscriptions */}
          {existingSubscriptions.length > 0 && (
            <div className='mb-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                Your Active Subscriptions
              </h3>
              <div className='space-y-3'>
                {existingSubscriptions.map(subscription => (
                  <div
                    key={subscription.id}
                    className='bg-green-50 border border-green-200 rounded-lg p-4'
                  >
                    <div className='flex justify-between items-center'>
                      <div>
                        <span className='font-medium text-green-800'>{subscription.tier.name}</span>
                        <span className='text-green-600 ml-2'>
                          {formatPrice(subscription.amount)}/month
                        </span>
                      </div>
                      <button
                        onClick={() => router.push('/dashboard/fan/subscriptions')}
                        className='text-sm text-green-700 hover:text-green-800 underline'
                      >
                        Manage
                      </button>
                    </div>
                    <p className='text-sm text-green-600 mt-1'>
                      Next billing: {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Tiers */}
          <div className='space-y-4'>
            {artist.tiers.map(tier => {
              const isSubscribed = isSubscribedToTier(tier.id);

              return (
                <div
                  key={tier.id}
                  className={`border rounded-lg p-6 ${
                    isSubscribed
                      ? 'border-green-300 bg-green-50'
                      : selectedTier?.id === tier.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  } transition-colors`}
                >
                  <div className='flex justify-between items-start mb-4'>
                    <div>
                      <h3 className='text-xl font-semibold text-gray-900'>{tier.name}</h3>
                      <p className='text-gray-600 mt-1'>{tier.description}</p>
                    </div>
                    <div className='text-right'>
                      <div className='text-2xl font-bold text-gray-900'>
                        {formatPrice(tier.minimumPrice)}+
                      </div>
                      <div className='text-sm text-gray-500'>per month</div>
                    </div>
                  </div>

                  <div className='flex justify-between items-center'>
                    <span className='text-sm text-gray-500'>
                      {tier.subscriberCount} subscriber{tier.subscriberCount !== 1 ? 's' : ''}
                    </span>

                    {isSubscribed ? (
                      <span className='px-4 py-2 bg-green-600 text-white rounded-lg'>
                        ✓ Subscribed
                      </span>
                    ) : (
                      <div className='flex gap-3 items-center'>
                        {selectedTier?.id === tier.id && (
                          <div className='flex items-center gap-2'>
                            <span className='text-sm text-gray-600'>Pay:</span>
                            <input
                              type='number'
                              min={parseFloat(tier.minimumPrice)}
                              step='0.01'
                              placeholder={tier.minimumPrice}
                              value={customAmount}
                              onChange={e => setCustomAmount(e.target.value)}
                              className='w-20 px-2 py-1 border border-gray-300 rounded text-sm'
                            />
                          </div>
                        )}

                        {selectedTier?.id === tier.id ? (
                          <div className='flex gap-2'>
                            <button
                              onClick={() => {
                                setSelectedTier(null);
                                setCustomAmount('');
                              }}
                              className='px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50'
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSubscribe(tier)}
                              disabled={loading}
                              className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                              {loading ? 'Processing...' : 'Subscribe'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedTier(tier)}
                            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                          >
                            Subscribe
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {artist.tiers.length === 0 && (
            <div className='text-center py-8 text-gray-500'>
              <p>This artist hasn't set up any subscription tiers yet.</p>
            </div>
          )}
        </div>

        {/* Recent Content */}
        <div>
          <h3 className='text-xl font-semibold text-gray-900 mb-4'>Recent Releases</h3>

          {artist.content.length > 0 ? (
            <div className='space-y-4'>
              {artist.content.map(content => (
                <div
                  key={content.id}
                  className='bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'
                >
                  <div className='flex gap-3'>
                    {content.thumbnailUrl && (
                      <div className='w-16 h-16 relative bg-gray-200 rounded'>
                        <Image
                          src={content.thumbnailUrl}
                          alt={content.title}
                          fill
                          className='object-cover rounded'
                        />
                      </div>
                    )}

                    <div className='flex-1'>
                      <h4 className='font-medium text-gray-900 mb-1'>{content.title}</h4>

                      {content.description && (
                        <p className='text-sm text-gray-600 mb-2 line-clamp-2'>
                          {content.description}
                        </p>
                      )}

                      <div className='flex justify-between items-center text-xs text-gray-500'>
                        <span className='capitalize'>{content.type.toLowerCase()}</span>
                        <span>{formatDate(content.createdAt)}</span>
                      </div>

                      {content.tags.length > 0 && (
                        <div className='flex gap-1 mt-2'>
                          {content.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className='px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded'
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8 text-gray-500'>
              <p>No public releases yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
