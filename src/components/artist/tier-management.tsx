'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Tier {
  id: string;
  name: string;
  description: string;
  minimumPrice: number;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TierFormData {
  name: string;
  description: string;
  minimumPrice: number;
}

export default function TierManagement() {
  const { data: session } = useSession();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [formData, setFormData] = useState<TierFormData>({
    name: '',
    description: '',
    minimumPrice: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch tiers on component mount
  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/artist/tiers');
      const result = await response.json();

      if (result.success) {
        setTiers(result.data);
      } else {
        setError(result.error || 'Failed to fetch tiers');
      }
    } catch (err) {
      setError('Failed to fetch tiers');
      console.error('Error fetching tiers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/artist/tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setTiers([...tiers, result.data]);
        setShowCreateForm(false);
        resetForm();
      } else {
        setError(result.error || 'Failed to create tier');
      }
    } catch (err) {
      setError('Failed to create tier');
      console.error('Error creating tier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/artist/tiers/${editingTier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setTiers(tiers.map(tier => (tier.id === editingTier.id ? result.data : tier)));
        setEditingTier(null);
        resetForm();
      } else {
        setError(result.error || 'Failed to update tier');
      }
    } catch (err) {
      setError('Failed to update tier');
      console.error('Error updating tier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/artist/tiers/${tierId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setTiers(tiers.filter(tier => tier.id !== tierId));
      } else {
        setError(result.error || 'Failed to delete tier');
      }
    } catch (err) {
      setError('Failed to delete tier');
      console.error('Error deleting tier:', err);
    }
  };

  const handleEditTier = (tier: Tier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description,
      minimumPrice: tier.minimumPrice,
    });
    setShowCreateForm(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      minimumPrice: 1,
    });
  };

  const cancelEdit = () => {
    setEditingTier(null);
    setShowCreateForm(false);
    resetForm();
    setError(null);
  };

  if (loading) {
    return (
      <div className='bg-white shadow rounded-lg p-6'>
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-1/4 mb-4'></div>
          <div className='space-y-3'>
            <div className='h-4 bg-gray-200 rounded'></div>
            <div className='h-4 bg-gray-200 rounded w-5/6'></div>
            <div className='h-4 bg-gray-200 rounded w-4/6'></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white shadow rounded-lg'>
      <div className='px-6 py-4 border-b border-gray-200'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-medium text-gray-900'>Subscription Tiers</h2>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingTier(null);
              resetForm();
            }}
            className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          >
            <PlusIcon className='h-4 w-4 mr-2' />
            Create Tier
          </button>
        </div>
      </div>

      {error && (
        <div className='px-6 py-4 bg-red-50 border-l-4 border-red-400'>
          <div className='text-sm text-red-700'>{error}</div>
        </div>
      )}

      {(showCreateForm || editingTier) && (
        <div className='px-6 py-4 bg-gray-50 border-b border-gray-200'>
          <form onSubmit={editingTier ? handleUpdateTier : handleCreateTier}>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div>
                <label htmlFor='name' className='block text-sm font-medium text-gray-700'>
                  Tier Name
                </label>
                <input
                  type='text'
                  id='name'
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
                  placeholder='e.g., Basic, Premium, VIP'
                  required
                />
              </div>
              <div>
                <label htmlFor='minimumPrice' className='block text-sm font-medium text-gray-700'>
                  Minimum Price ($)
                </label>
                <input
                  type='number'
                  id='minimumPrice'
                  min='1'
                  max='1000'
                  step='0.01'
                  value={formData.minimumPrice}
                  onChange={e =>
                    setFormData({ ...formData, minimumPrice: parseFloat(e.target.value) })
                  }
                  className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
                  required
                />
              </div>
            </div>
            <div className='mt-4'>
              <label htmlFor='description' className='block text-sm font-medium text-gray-700'>
                Description
              </label>
              <textarea
                id='description'
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
                placeholder='Describe what subscribers get with this tier...'
                required
              />
            </div>
            <div className='mt-4 flex justify-end space-x-3'>
              <button
                type='button'
                onClick={cancelEdit}
                className='px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={submitting}
                className='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50'
              >
                {submitting ? 'Saving...' : editingTier ? 'Update Tier' : 'Create Tier'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className='px-6 py-4'>
        {tiers.length === 0 ? (
          <div className='text-center py-8'>
            <div className='text-gray-500 mb-4'>No tiers created yet</div>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingTier(null);
                resetForm();
              }}
              className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
            >
              <PlusIcon className='h-4 w-4 mr-2' />
              Create Your First Tier
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {tiers.map(tier => (
              <div
                key={tier.id}
                className='border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'
              >
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <h3 className='text-lg font-medium text-gray-900'>{tier.name}</h3>
                    <p className='text-sm text-gray-600 mt-1'>{tier.description}</p>
                    <div className='mt-3 space-y-1'>
                      <div className='text-sm'>
                        <span className='font-medium'>Minimum Price:</span> ${tier.minimumPrice}
                      </div>
                      <div className='text-sm'>
                        <span className='font-medium'>Subscribers:</span> {tier.subscriberCount}
                      </div>
                      <div className='text-sm'>
                        <span className='font-medium'>Status:</span>{' '}
                        <span className={tier.isActive ? 'text-green-600' : 'text-red-600'}>
                          {tier.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className='flex space-x-2 ml-4'>
                    <button
                      onClick={() => handleEditTier(tier)}
                      className='p-2 text-gray-400 hover:text-gray-600'
                      title='Edit tier'
                    >
                      <PencilIcon className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => handleDeleteTier(tier.id)}
                      className='p-2 text-gray-400 hover:text-red-600'
                      title='Delete tier'
                      disabled={tier.subscriberCount > 0}
                    >
                      <TrashIcon className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
