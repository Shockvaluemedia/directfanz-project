'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PlusIcon,
  SparklesIcon,
  ClockIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface TierCreationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function TierCreationForm({
  onSuccess,
  onCancel,
}: TierCreationFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [allowFreeTrial, setAllowFreeTrial] = useState(true);
  const [trialDays, setTrialDays] = useState('7');
  const [trialDescription, setTrialDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tier templates
  const templates = [
    {
      name: 'Supporter',
      price: '5',
      description: 'Basic exclusive content and updates',
      trialDays: '7',
    },
    {
      name: 'Super Fan',
      price: '10',
      description: 'All content + early access to new releases',
      trialDays: '7',
    },
    {
      name: 'VIP',
      price: '25',
      description: 'Everything + personal perks and recognition',
      trialDays: '14',
    },
  ];

  function applyTemplate(template: typeof templates[0]) {
    setName(template.name);
    setPrice(template.price);
    setDescription(template.description);
    setTrialDays(template.trialDays);
    setTrialDescription(`Try ${template.name} free for ${template.trialDays} days`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!name || !description || !price) {
        throw new Error('Please fill in all required fields');
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 1) {
        throw new Error('Price must be at least $1');
      }

      if (allowFreeTrial) {
        const trialDaysNum = parseInt(trialDays);
        if (isNaN(trialDaysNum) || trialDaysNum < 1 || trialDaysNum > 90) {
          throw new Error('Trial days must be between 1 and 90');
        }
      }

      // Create tier via API
      const response = await fetch('/api/artist/tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          minimumPrice: priceNum,
          allowFreeTrial,
          trialDays: allowFreeTrial ? parseInt(trialDays) : 0,
          trialDescription: allowFreeTrial ? trialDescription : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create tier');
      }

      // Success!
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create tier');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Templates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Start Templates
        </label>
        <div className="grid grid-cols-3 gap-3">
          {templates.map((template) => (
            <button
              key={template.name}
              type="button"
              onClick={() => applyTemplate(template)}
              className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors text-left"
            >
              <div className="font-semibold text-gray-900 dark:text-white">
                {template.name}
              </div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                ${template.price}/mo
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {template.trialDays} day trial
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tier Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tier Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Super Fan"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what fans get with this tier..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          required
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Monthly Price *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 dark:text-gray-400">$</span>
          </div>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="10.00"
            step="0.01"
            min="1"
            className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          You'll receive 80% after platform fees
        </p>
      </div>

      {/* Free Trial Toggle */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-gray-900 dark:text-white">
              Offer Free Trial
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAllowFreeTrial(!allowFreeTrial)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              allowFreeTrial
                ? 'bg-indigo-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowFreeTrial ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {allowFreeTrial && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                Trial Duration (days)
              </label>
              <select
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="3">3 days</option>
                <option value="7">7 days (Recommended)</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trial Description (optional)
              </label>
              <input
                type="text"
                value={trialDescription}
                onChange={(e) => setTrialDescription(e.target.value)}
                placeholder={`Try free for ${trialDays} days, cancel anytime`}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
              <CheckIcon className="w-4 h-4 inline text-indigo-600 dark:text-indigo-400 mr-1" />
              Fans can try your content for{' '}
              <strong>{trialDays} days</strong> before being charged. This
              significantly increases conversion rates!
            </div>
          </motion.div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          {loading ? 'Creating...' : 'Create Tier'}
        </button>
      </div>
    </form>
  );
}
