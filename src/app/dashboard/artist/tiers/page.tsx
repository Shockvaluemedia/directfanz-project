'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface Tier {
  id: string;
  name: string;
  minimumPrice: number;
  description: string;
  subscriberCount: number;
  isActive: boolean;
}

interface TierFormData {
  name: string;
  price: string;
  description: string;
}

const emptyForm: TierFormData = {
  name: '',
  price: '',
  description: '',
};

export default function ArtistTiersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TierFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchTiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/artist/tiers');
      if (!res.ok) {
        throw new Error(`Failed to fetch tiers: ${res.statusText}`);
      }
      const data = await res.json();
      // API responds with { success, data: Tier[] }
      setTiers(Array.isArray(data) ? data : (data.data ?? data.tiers ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (session.user.role !== 'ARTIST') {
      router.push('/dashboard/fan');
      return;
    }
    fetchTiers();
  }, [session, status, router, fetchTiers]);

  const openCreateForm = () => {
    setEditingTierId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (tier: Tier) => {
    setEditingTierId(tier.id);
    setFormData({
      name: tier.name,
      price: tier.minimumPrice.toString(),
      description: tier.description,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTierId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name: formData.name,
      minimumPrice: parseFloat(formData.price),
      description: formData.description,
    };

    try {
      const url = editingTierId
        ? `/api/artist/tiers/${editingTierId}`
        : '/api/artist/tiers';
      const method = editingTierId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${editingTierId ? 'update' : 'create'} tier`);
      }

      closeForm();
      await fetchTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return;

    try {
      setError(null);
      const res = await fetch(`/api/artist/tiers/${tierId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete tier');
      }
      await fetchTiers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tier');
    }
  };

  if (status === 'loading' || (loading && tiers.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tiers...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Tiers</h1>
            <p className="mt-2 text-gray-600">
              Manage your subscription tiers and pricing
            </p>
          </div>
          <button
            onClick={openCreateForm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            + Create Tier
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">
              X
            </button>
          </div>
        )}

        {/* Create / Edit Form */}
        {showForm && (
          <div className="mb-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingTierId ? 'Edit Tier' : 'Create New Tier'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tier Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Premium"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($/month)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="9.99"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum $1.00 per month</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A short description of what subscribers get"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  {submitting
                    ? 'Saving...'
                    : editingTierId
                      ? 'Update Tier'
                      : 'Create Tier'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tiers List */}
        {tiers.length === 0 && !loading ? (
          <div className="bg-white shadow rounded-lg px-6 py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tiers yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first subscription tier to start earning from your fans.
            </p>
            <button
              onClick={openCreateForm}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              + Create Your First Tier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`bg-white rounded-lg shadow p-6 border-2 ${
                  tier.isActive ? 'border-indigo-200' : 'border-gray-200 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      tier.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  ${tier.minimumPrice.toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </div>

                <p className="text-sm text-gray-600 mb-4">{tier.description}</p>

                <div className="flex items-center text-sm text-gray-500 mb-4 border-t border-gray-100 pt-4">
                  <span className="font-medium text-gray-700">{tier.subscriberCount}</span>
                  <span className="ml-1">
                    {tier.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openEditForm(tier)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tier.id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
