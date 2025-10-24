'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface ScheduledContent {
  id: string;
  title: string;
  type: string;
  scheduledFor: Date;
  timezone: string;
  publishStatus: string;
  thumbnailUrl?: string;
  tiers: Array<{ id: string; name: string }>;
}

interface ContentByDay {
  [dayKey: string]: ScheduledContent[];
}

interface CalendarData {
  month: number;
  year: number;
  contentByDay: ContentByDay;
  totalScheduled: number;
}

export default function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch calendar data when month/year changes
  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  async function fetchCalendarData() {
    setLoading(true);
    setError(null);

    try {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      const response = await fetch(
        `/api/artist/content/calendar?month=${month}&year=${year}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch calendar data');
      }

      const result = await response.json();
      setCalendarData(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function renderCalendar() {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days: JSX.Element[] = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="min-h-24 bg-gray-50 dark:bg-gray-900" />
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayContent = calendarData?.contentByDay[dateKey] || [];
      const isToday = isDateToday(day);

      days.push(
        <motion.div
          key={day}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`min-h-24 border border-gray-200 dark:border-gray-700 p-2 ${
            isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-800'
          }`}
        >
          <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {day}
          </div>

          <div className="space-y-1">
            {dayContent.map((content) => (
              <motion.div
                key={content.id}
                whileHover={{ scale: 1.02 }}
                className="text-xs p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors"
                title={content.title}
              >
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate font-medium">
                    {formatTime(new Date(content.scheduledFor))}
                  </span>
                </div>
                <div className="truncate text-gray-700 dark:text-gray-300">
                  {content.title}
                </div>
                {content.tiers.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {content.tiers.map(t => t.name).join(', ')}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    }

    return days;
  }

  function isDateToday(day: number): boolean {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  }

  function formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500 dark:text-gray-400">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Scheduled Content
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {calendarData?.totalScheduled || 0} scheduled
            </span>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>

        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Day Labels */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {renderCalendar()}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-100 dark:bg-indigo-900/40 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Scheduled Content</span>
        </div>
      </div>
    </div>
  );
}
