'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Subscription {
  id: string;
  amount: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  tier: {
    id: string;
    name: string;
    description: string;
    minimumPrice: string;
    artist: {
      id: string;
      displayName: string;
      avatar: string | null;
    };
  };
}

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/fan/subscriptions');
      if (!response.ok) throw new Error('Failed to fetch subscriptions');

      const data = await response.json();
      setSubscriptions(data.subscriptions);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleUpdateAmount = async (subscriptionId: string) => {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    const amount = parseFloat(newAmount);
    const minimumPrice = parseFloat(subscription.tier.minimumPrice);

    if (amount < minimumPrice) {
      alert(`Amount must be at least ${formatPrice(subscription.tier.minimumPrice)}`);
      return;
    }

    setUpdatingId(subscriptionId);
    try {
      const response = await fetch(`/api/fan/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update subscription');
      }

      // Update local state
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === subscriptionId ? { ...sub, amount: amount.toString() } : sub))
      );

      setEditingId(null);
      setNewAmount('');
      alert('Subscription amount updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      alert(error instanceof Error ? error.message : 'Failed to update subscription');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    if (
      !confirm(
        `Are you sure you want to cancel your subscription to ${subscription.tier.artist.displayName}? You'll lose access to their exclusive content.`
      )
    ) {
      return;
    }

    setCancelingId(subscriptionId);
    try {
      const response = await fetch(`/api/fan/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      // Update local state
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === subscriptionId ? { ...sub, status: 'CANCELED' } : sub))
      );

      alert('Subscription canceled successfully');
    } catch (error) {
      console.error('Cancel error:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setCancelingId(null);
    }
  };

  const startEditing = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setNewAmount(subscription.amount);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewAmount('');
  };

  if (loading) {
    return (
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Loading your subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-4'>Your Subscriptions</h1>
        <p className='text-gray-600'>Manage your artist subscriptions and support levels</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className='text-center py-12'>
          <div className='text-gray-500 mb-4'>
            <svg
              className='mx-auto h-12 w-12'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
              />
            </svg>
          </div>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>No subscriptions yet</h3>
          <p className='text-gray-500 mb-4'>
            Start supporting your favorite artists by subscribing to their tiers
          </p>
          <button
            onClick={() => router.push('/discover')}
            className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
          >
            Discover Artists
          </button>
        </div>
      ) : (
        <div className='space-y-6'>
          {subscriptions.map(subscription => (
            <div
              key={subscription.id}
              className='bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden'
            >
              <div className='p-6'>
                <div className='flex items-start justify-between'>
                  {/* Artist Info */}
                  <div className='flex items-center gap-4'>
                    <div className='w-16 h-16 relative bg-gray-200 rounded-full overflow-hidden'>
                      {subscription.tier.artist.avatar ? (
                        <Image
                          src={subscription.tier.artist.avatar}
                          alt={subscription.tier.artist.displayName}
                          fill
                          className='object-cover'
                        />
                      ) : (
                        <div className='w-full h-full flex items-center justify-center'>
                          <span className='text-lg font-bold text-gray-600'>
                            {subscription.tier.artist.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className='text-lg font-semibold text-gray-900'>
                        {subscription.tier.artist.displayName}
                      </h3>
                      <p className='text-gray-600'>{subscription.tier.name}</p>
                      <p className='text-sm text-gray-500 mt-1'>{subscription.tier.description}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}
                  >
                    {subscription.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>

                {/* Subscription Details */}
                <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
                  <div>
                    <span className='text-gray-500'>Current Amount:</span>
                    <div className='font-semibold text-lg text-gray-900'>
                      {formatPrice(subscription.amount)}/month
                    </div>
                    <div className='text-xs text-gray-500'>
                      Minimum: {formatPrice(subscription.tier.minimumPrice)}
                    </div>
                  </div>

                  <div>
                    <span className='text-gray-500'>Next Billing:</span>
                    <div className='font-medium text-gray-900'>
                      {formatDate(subscription.currentPeriodEnd)}
                    </div>
                  </div>

                  <div>
                    <span className='text-gray-500'>Subscribed Since:</span>
                    <div className='font-medium text-gray-900'>
                      {formatDate(subscription.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {subscription.status === 'ACTIVE' && (
                  <div className='mt-6 flex flex-wrap gap-3'>
                    {editingId === subscription.id ? (
                      <div className='flex items-center gap-3'>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-gray-600'>New amount:</span>
                          <input
                            type='number'
                            min={parseFloat(subscription.tier.minimumPrice)}
                            step='0.01'
                            value={newAmount}
                            onChange={e => setNewAmount(e.target.value)}
                            className='w-24 px-3 py-1 border border-gray-300 rounded text-sm'
                          />
                        </div>

                        <button
                          onClick={() => handleUpdateAmount(subscription.id)}
                          disabled={updatingId === subscription.id}
                          className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm'
                        >
                          {updatingId === subscription.id ? 'Updating...' : 'Update'}
                        </button>

                        <button
                          onClick={cancelEditing}
                          className='px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm'
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(subscription)}
                          className='px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 text-sm'
                        >
                          Change Amount
                        </button>

                        <button
                          onClick={() => router.push(`/artist/${subscription.tier.artist.id}`)}
                          className='px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm'
                        >
                          View Artist
                        </button>

                        <button
                          onClick={() => handleCancelSubscription(subscription.id)}
                          disabled={cancelingId === subscription.id}
                          className='px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm'
                        >
                          {cancelingId === subscription.id ? 'Canceling...' : 'Cancel Subscription'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {subscription.status === 'CANCELED' && (
                  <div className='mt-4 p-3 bg-red-50 border border-red-200 rounded'>
                    <p className='text-sm text-red-700'>
                      This subscription has been canceled. You'll continue to have access until{' '}
                      {formatDate(subscription.currentPeriodEnd)}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
