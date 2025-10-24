'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  SparklesIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface OptimalTime {
  day: string;
  dayOfWeek: number;
  hour: number;
  time: string;
  engagement: string;
  score: number;
  isDefault?: boolean;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentTitle: string;
  onScheduled?: () => void;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  contentId,
  contentTitle,
  onScheduled,
}: ScheduleModalProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptimalTimes, setLoadingOptimalTimes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect user timezone
  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  // Fetch optimal times when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOptimalTimes();
    }
  }, [isOpen]);

  async function fetchOptimalTimes() {
    setLoadingOptimalTimes(true);

    try {
      const response = await fetch('/api/artist/content/optimal-times');
      if (response.ok) {
        const result = await response.json();
        setOptimalTimes(result.data.optimalTimes || []);
      }
    } catch (err) {
      console.error('Failed to fetch optimal times:', err);
    } finally {
      setLoadingOptimalTimes(false);
    }
  }

  function applyOptimalTime(optimalTime: OptimalTime) {
    // Calculate next occurrence of this day
    const now = new Date();
    const targetDay = optimalTime.dayOfWeek;
    const currentDay = now.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);

    // Format date for input
    const dateStr = targetDate.toISOString().split('T')[0];
    setScheduledDate(dateStr);

    // Format time for input
    const timeStr = `${String(optimalTime.hour).padStart(2, '0')}:00`;
    setScheduledTime(timeStr);
  }

  async function handleSchedule() {
    if (!scheduledDate || !scheduledTime) {
      setError('Please select both date and time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Combine date and time
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);

      // Validate future date
      if (scheduledFor <= new Date()) {
        setError('Scheduled time must be in the future');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/artist/content/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          scheduledFor: scheduledFor.toISOString(),
          timezone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule content');
      }

      // Success!
      onScheduled?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule content');
    } finally {
      setLoading(false);
    }
  }

  // Get minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Schedule Content
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {contentTitle}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Optimal Times Suggestions */}
              {!loadingOptimalTimes && optimalTimes.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Suggested times for best engagement
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {optimalTimes.map((time, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => applyOptimalTime(time)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          time.engagement === 'Very High'
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {time.day} {time.time}
                        </div>
                        <div className="text-xs opacity-80">
                          {time.engagement}
                          {time.engagement === 'Very High' && ' ⭐'}
                          {time.isDefault && ' (Recommended)'}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-1" />
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Time Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <ClockIcon className="w-4 h-4 inline mr-1" />
                  Time
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Timezone Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <GlobeAltIcon className="w-4 h-4 inline mr-1" />
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                </select>
              </div>

              {/* Preview */}
              {scheduledDate && scheduledTime && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Will be published on:
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(`${scheduledDate}T${scheduledTime}:00`).toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                onClick={handleSchedule}
                disabled={loading || !scheduledDate || !scheduledTime}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
