'use client';

import React, { useState } from 'react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { EnhancedButton } from './enhanced-button';
import { EnhancedCard, EnhancedCardContent } from './enhanced-card';
import { Calendar, Filter, Download, RefreshCw, X, ChevronDown } from 'lucide-react';

// Date range presets
export type DateRangePreset = 
  | '7d' | '30d' | '90d' | '1y'
  | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'
  | 'custom';

// Filter types
export interface AnalyticsFilters {
  dateRange: {
    preset: DateRangePreset;
    startDate?: Date;
    endDate?: Date;
  };
  contentType?: 'all' | 'video' | 'audio' | 'photo' | 'live';
  subscriptionTier?: 'all' | 'basic' | 'premium' | 'vip' | 'exclusive';
  sortBy?: 'date' | 'views' | 'engagement' | 'revenue';
  sortOrder?: 'asc' | 'desc';
  showZeroValues?: boolean;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  showContentTypeFilter?: boolean;
  showSubscriptionFilter?: boolean;
  showSortOptions?: boolean;
  onExport?: () => void;
  onRefresh?: () => void;
  className?: string;
}

// Date range preset configurations
const dateRangePresets = [
  { key: 'today', label: 'Today', description: 'Today only' },
  { key: 'yesterday', label: 'Yesterday', description: 'Yesterday only' },
  { key: '7d', label: 'Last 7 Days', description: 'Past week' },
  { key: '30d', label: 'Last 30 Days', description: 'Past month' },
  { key: '90d', label: 'Last 90 Days', description: 'Past quarter' },
  { key: 'thisWeek', label: 'This Week', description: 'Current week' },
  { key: 'lastWeek', label: 'Last Week', description: 'Previous week' },
  { key: 'thisMonth', label: 'This Month', description: 'Current month' },
  { key: 'lastMonth', label: 'Last Month', description: 'Previous month' },
  { key: '1y', label: 'Last Year', description: 'Past 12 months' },
  { key: 'custom', label: 'Custom Range', description: 'Pick your dates' },
] as const;

const contentTypeOptions = [
  { value: 'all', label: 'All Content' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'photo', label: 'Photos' },
  { value: 'live', label: 'Live Streams' },
];

const subscriptionTierOptions = [
  { value: 'all', label: 'All Tiers' },
  { value: 'basic', label: 'Basic ($5)' },
  { value: 'premium', label: 'Premium ($15)' },
  { value: 'vip', label: 'VIP ($30)' },
  { value: 'exclusive', label: 'Exclusive ($50)' },
];

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'views', label: 'Views' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'revenue', label: 'Revenue' },
];

// Utility function to get date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
    case '7d':
      return { startDate: subDays(now, 6), endDate: now };
    case '30d':
      return { startDate: subDays(now, 29), endDate: now };
    case '90d':
      return { startDate: subDays(now, 89), endDate: now };
    case '1y':
      return { startDate: subDays(now, 364), endDate: now };
    case 'thisWeek':
      return { startDate: startOfWeek(now), endDate: endOfWeek(now) };
    case 'lastWeek':
      const lastWeekStart = startOfWeek(subWeeks(now, 1));
      const lastWeekEnd = endOfWeek(subWeeks(now, 1));
      return { startDate: lastWeekStart, endDate: lastWeekEnd };
    case 'thisMonth':
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
    case 'custom':
      return { 
        startDate: customStart || subDays(now, 30), 
        endDate: customEnd || now 
      };
    default:
      return { startDate: subDays(now, 29), endDate: now };
  }
}

// Dropdown component for filters
function FilterDropdown({ 
  label, 
  value, 
  options, 
  onChange, 
  icon 
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <EnhancedButton
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        rightIcon={<ChevronDown className="w-4 h-4" />}
        leftIcon={icon}
        className="justify-between min-w-32"
      >
        {selectedOption?.label || label}
      </EnhancedButton>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 min-w-48">
            <div className="py-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    value === option.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Date range picker component
function DateRangePicker({ 
  filters, 
  onFiltersChange 
}: {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
}) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState(
    filters.dateRange.startDate ? format(filters.dateRange.startDate, 'yyyy-MM-dd') : ''
  );
  const [customEnd, setCustomEnd] = useState(
    filters.dateRange.endDate ? format(filters.dateRange.endDate, 'yyyy-MM-dd') : ''
  );

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      const { startDate, endDate } = getDateRangeFromPreset(preset);
      onFiltersChange({
        ...filters,
        dateRange: {
          preset,
          startDate,
          endDate,
        },
      });
    }
  };

  const handleCustomDateChange = () => {
    if (customStart && customEnd) {
      onFiltersChange({
        ...filters,
        dateRange: {
          preset: 'custom',
          startDate: new Date(customStart),
          endDate: new Date(customEnd),
        },
      });
    }
  };

  const getDateRangeLabel = () => {
    const { preset, startDate, endDate } = filters.dateRange;
    
    if (preset === 'custom' && startDate && endDate) {
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
    }
    
    const presetConfig = dateRangePresets.find(p => p.key === preset);
    return presetConfig?.label || 'Last 30 Days';
  };

  return (
    <div className="relative">
      {/* Date Range Button */}
      <EnhancedButton
        variant="secondary"
        size="sm"
        onClick={() => setShowCustomPicker(!showCustomPicker)}
        leftIcon={<Calendar className="w-4 h-4" />}
        rightIcon={<ChevronDown className="w-4 h-4" />}
        className="justify-between min-w-40"
      >
        {getDateRangeLabel()}
      </EnhancedButton>

      {/* Date Range Dropdown */}
      {showCustomPicker && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowCustomPicker(false)}
          />
          <EnhancedCard className="absolute right-0 mt-1 z-20 min-w-80">
            <EnhancedCardContent className="p-4">
              {/* Preset Options */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {dateRangePresets.map((preset) => (
                  <EnhancedButton
                    key={preset.key}
                    variant={filters.dateRange.preset === preset.key ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handlePresetChange(preset.key)}
                    className="justify-start text-xs"
                  >
                    <div className="text-left">
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-xs opacity-75">{preset.description}</div>
                    </div>
                  </EnhancedButton>
                ))}
              </div>

              {/* Custom Date Inputs */}
              {filters.dateRange.preset === 'custom' && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <EnhancedButton
                    variant="primary"
                    size="sm"
                    onClick={handleCustomDateChange}
                    disabled={!customStart || !customEnd}
                    className="w-full"
                  >
                    Apply Date Range
                  </EnhancedButton>
                </div>
              )}
            </EnhancedCardContent>
          </EnhancedCard>
        </>
      )}
    </div>
  );
}

export function AnalyticsFilters({
  filters,
  onFiltersChange,
  showContentTypeFilter = false,
  showSubscriptionFilter = false,
  showSortOptions = false,
  onExport,
  onRefresh,
  className = '',
}: AnalyticsFiltersProps) {
  const hasActiveFilters = 
    filters.contentType !== 'all' || 
    filters.subscriptionTier !== 'all' ||
    filters.sortBy !== 'date' ||
    filters.sortOrder !== 'desc';

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      contentType: 'all',
      subscriptionTier: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
      showZeroValues: false,
    });
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${className}`}>
      {/* Main Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range Picker */}
        <DateRangePicker 
          filters={filters} 
          onFiltersChange={onFiltersChange} 
        />

        {/* Content Type Filter */}
        {showContentTypeFilter && (
          <FilterDropdown
            label="Content Type"
            value={filters.contentType || 'all'}
            options={contentTypeOptions}
            onChange={(value) => 
              onFiltersChange({
                ...filters,
                contentType: value as typeof filters.contentType,
              })
            }
          />
        )}

        {/* Subscription Tier Filter */}
        {showSubscriptionFilter && (
          <FilterDropdown
            label="Subscription Tier"
            value={filters.subscriptionTier || 'all'}
            options={subscriptionTierOptions}
            onChange={(value) => 
              onFiltersChange({
                ...filters,
                subscriptionTier: value as typeof filters.subscriptionTier,
              })
            }
          />
        )}

        {/* Sort Options */}
        {showSortOptions && (
          <>
            <FilterDropdown
              label="Sort By"
              value={filters.sortBy || 'date'}
              options={sortOptions}
              onChange={(value) => 
                onFiltersChange({
                  ...filters,
                  sortBy: value as typeof filters.sortBy,
                })
              }
            />
            
            <EnhancedButton
              variant="secondary"
              size="sm"
              onClick={() => 
                onFiltersChange({
                  ...filters,
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
                })
              }
              className="min-w-16"
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'} {filters.sortOrder?.toUpperCase()}
            </EnhancedButton>
          </>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <EnhancedButton
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            leftIcon={<X className="w-4 h-4" />}
            className="text-gray-500"
          >
            Clear
          </EnhancedButton>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Show Zero Values Toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={filters.showZeroValues || false}
            onChange={(e) => 
              onFiltersChange({
                ...filters,
                showZeroValues: e.target.checked,
              })
            }
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Show zero values
        </label>

        {/* Refresh Button */}
        {onRefresh && (
          <EnhancedButton
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </EnhancedButton>
        )}

        {/* Export Button */}
        {onExport && (
          <EnhancedButton
            variant="secondary"
            size="sm"
            onClick={onExport}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </EnhancedButton>
        )}
      </div>
    </div>
  );
}

// Hook for managing analytics filters state
export function useAnalyticsFilters(initialFilters?: Partial<AnalyticsFilters>) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      preset: '30d',
      ...getDateRangeFromPreset('30d'),
    },
    contentType: 'all',
    subscriptionTier: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
    showZeroValues: false,
    ...initialFilters,
  });

  return {
    filters,
    updateFilters: setFilters,
    dateRange: getDateRangeFromPreset(
      filters.dateRange.preset, 
      filters.dateRange.startDate, 
      filters.dateRange.endDate
    ),
  };
}