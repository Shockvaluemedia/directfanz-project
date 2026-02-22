'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  DollarSign,
  Clock,
  Calendar,
  MapPin,
  Tag,
  Users,
  Video,
  Image as ImageIcon,
  Mic,
  Play,
  Globe,
  Verified,
  Crown,
  TrendingUp,
  Award,
  Heart,
  Bookmark,
  Eye,
  SlidersHorizontal,
  RotateCcw,
  Save,
  Settings,
  Search,
  Hash,
  User,
  Building
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
  description?: string;
  icon?: React.ReactNode;
}

interface FilterGroup {
  id: string;
  name: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'boolean' | 'tags' | 'rating' | 'price' | 'custom';
  icon?: React.ReactNode;
  options?: FilterOption[];
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  required?: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  priority?: number;
  dependencies?: string[]; // Other filter IDs this depends on
  conditional?: (filters: Record<string, any>) => boolean;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: Date;
  isDefault?: boolean;
}

interface AdvancedFiltersProps {
  filters: FilterGroup[];
  values?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
  onSaveFilter?: (name: string, filters: Record<string, any>) => void;
  onLoadFilter?: (filterId: string) => void;
  savedFilters?: SavedFilter[];
  showCounts?: boolean;
  allowSaving?: boolean;
  className?: string;
  maxHeight?: number;
  compactMode?: boolean;
}

const defaultFilterGroups: FilterGroup[] = [
  {
    id: 'contentType',
    name: 'Content Type',
    type: 'multiselect',
    icon: <Video className="w-4 h-4" />,
    expanded: true,
    priority: 1,
    options: [
      { value: 'video', label: 'Videos', count: 12540, icon: <Video className="w-4 h-4" /> },
      { value: 'photo', label: 'Photos', count: 8230, icon: <ImageIcon className="w-4 h-4" /> },
      { value: 'audio', label: 'Audio', count: 1450, icon: <Mic className="w-4 h-4" /> },
      { value: 'live', label: 'Live Streams', count: 89, icon: <Play className="w-4 h-4" /> }
    ]
  },
  {
    id: 'category',
    name: 'Category',
    type: 'multiselect',
    icon: <Tag className="w-4 h-4" />,
    expanded: true,
    priority: 2,
    options: [
      { value: 'amateur', label: 'Amateur', count: 5670 },
      { value: 'professional', label: 'Professional', count: 3240 },
      { value: 'couples', label: 'Couples', count: 2180 },
      { value: 'solo', label: 'Solo', count: 4560 },
      { value: 'group', label: 'Group', count: 890 }
    ]
  },
  {
    id: 'rating',
    name: 'Minimum Rating',
    type: 'rating',
    icon: <Star className="w-4 h-4" />,
    priority: 3,
    min: 0,
    max: 5,
    step: 0.5
  },
  {
    id: 'price',
    name: 'Price Range',
    type: 'price',
    icon: <DollarSign className="w-4 h-4" />,
    priority: 4,
    min: 0,
    max: 100,
    unit: '$'
  },
  {
    id: 'duration',
    name: 'Duration',
    type: 'range',
    icon: <Clock className="w-4 h-4" />,
    priority: 5,
    min: 0,
    max: 7200,
    unit: 'minutes'
  },
  {
    id: 'uploadDate',
    name: 'Upload Date',
    type: 'select',
    icon: <Calendar className="w-4 h-4" />,
    priority: 6,
    options: [
      { value: 'any', label: 'Any Time' },
      { value: 'today', label: 'Today', count: 45 },
      { value: 'week', label: 'This Week', count: 312 },
      { value: 'month', label: 'This Month', count: 1240 },
      { value: 'year', label: 'This Year', count: 8930 }
    ]
  },
  {
    id: 'location',
    name: 'Location',
    type: 'multiselect',
    icon: <MapPin className="w-4 h-4" />,
    priority: 7,
    collapsible: true,
    options: [
      { value: 'us', label: 'United States', count: 4560 },
      { value: 'ca', label: 'Canada', count: 890 },
      { value: 'uk', label: 'United Kingdom', count: 1230 },
      { value: 'de', label: 'Germany', count: 670 },
      { value: 'fr', label: 'France', count: 540 },
      { value: 'jp', label: 'Japan', count: 340 }
    ]
  },
  {
    id: 'creatorTier',
    name: 'Creator Tier',
    type: 'multiselect',
    icon: <Crown className="w-4 h-4" />,
    priority: 8,
    collapsible: true,
    options: [
      { value: 'vip', label: 'VIP', count: 156, icon: <Crown className="w-4 h-4 text-yellow-500" /> },
      { value: 'premium', label: 'Premium', count: 890, icon: <Award className="w-4 h-4 text-purple-500" /> },
      { value: 'verified', label: 'Verified', count: 2340, icon: <Verified className="w-4 h-4 text-blue-500" /> },
      { value: 'free', label: 'Free', count: 8920 }
    ]
  },
  {
    id: 'features',
    name: 'Features',
    type: 'multiselect',
    icon: <SlidersHorizontal className="w-4 h-4" />,
    priority: 9,
    collapsible: true,
    options: [
      { value: 'hd', label: '4K/HD Quality', count: 3456 },
      { value: 'subtitles', label: 'Subtitles', count: 1230 },
      { value: 'interactive', label: 'Interactive', count: 567 },
      { value: 'download', label: 'Downloadable', count: 2340 }
    ]
  },
  {
    id: 'trending',
    name: 'Trending',
    type: 'boolean',
    icon: <TrendingUp className="w-4 h-4" />,
    priority: 10,
    collapsible: true
  }
];

export function AdvancedFilters({
  filters = defaultFilterGroups,
  values = {},
  onFiltersChange,
  onSaveFilter,
  onLoadFilter,
  savedFilters = [],
  showCounts = true,
  allowSaving = true,
  className = '',
  maxHeight = 600,
  compactMode = false
}: AdvancedFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>(values);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(filters.filter(f => f.expanded).map(f => f.id))
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 7200]);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [localSavedFilters, setLocalSavedFilters] = useLocalStorage<SavedFilter[]>('advanced-filters', []);

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Update parent component when filters change
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(activeFilters);
    }
  }, [activeFilters, onFiltersChange]);

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        delete newFilters[filterId];
      } else {
        newFilters[filterId] = value;
      }
      return newFilters;
    });
    
    announce(`Filter ${filterId} updated`, 'polite');
  }, [announce]);

  const clearFilter = (filterId: string) => {
    handleFilterChange(filterId, undefined);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setPriceRange([0, 100]);
    setDurationRange([0, 7200]);
    setRatingValue(0);
    announce('All filters cleared', 'polite');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      return newExpanded;
    });
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: activeFilters,
      createdAt: new Date()
    };

    setLocalSavedFilters(prev => [...prev, newFilter]);
    
    if (onSaveFilter) {
      onSaveFilter(filterName.trim(), activeFilters);
    }

    setShowSaveDialog(false);
    setFilterName('');
    announce(`Filter saved as "${newFilter.name}"`, 'polite');
  };

  const loadFilter = (filter: SavedFilter) => {
    setActiveFilters(filter.filters);
    
    if (onLoadFilter) {
      onLoadFilter(filter.id);
    }

    announce(`Loaded filter "${filter.name}"`, 'polite');
  };

  const deleteFilter = (filterId: string) => {
    setLocalSavedFilters(prev => prev.filter(f => f.id !== filterId));
    announce('Filter deleted', 'polite');
  };

  const getFilterCount = () => {
    return Object.keys(activeFilters).length;
  };

  const renderStarRating = (value: number, onChange: (value: number) => void, max: number = 5) => (
    <div className="flex items-center space-x-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i + 1)}
          className={`w-6 h-6 transition-colors ${
            i < value
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-gray-300 hover:text-gray-400'
          }`}
          aria-label={`${i + 1} star${i + 1 === 1 ? '' : 's'}`}
        >
          <Star className="w-full h-full fill-current" />
        </button>
      ))}
      <span className="text-sm text-gray-600 ml-2">
        {value > 0 ? `${value}+ stars` : 'Any rating'}
      </span>
    </div>
  );

  const renderPriceRange = (value: [number, number], onChange: (value: [number, number]) => void, max: number = 100) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="0"
          max={max}
          value={value[0]}
          onChange={(e) => onChange([Number(e.target.value), value[1]])}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Min"
        />
        <span className="text-gray-500">to</span>
        <input
          type="number"
          min="0"
          max={max}
          value={value[1]}
          onChange={(e) => onChange([value[0], Number(e.target.value)])}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Max"
        />
      </div>
      <div className="text-sm text-gray-600">
        {value[0] === 0 && value[1] === max ? 'Any price' : `$${value[0]} - $${value[1]}`}
      </div>
    </div>
  );

  const renderRangeSlider = (value: [number, number], onChange: (value: [number, number]) => void, min: number = 0, max: number = 100, unit?: string) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value[0]}
          onChange={(e) => onChange([Number(e.target.value), value[1]])}
          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
        />
        <span className="text-gray-500">to</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value[1]}
          onChange={(e) => onChange([value[0], Number(e.target.value)])}
          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500"
        />
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
    </div>
  );

  const renderFilterGroup = (group: FilterGroup) => {
    if (group.conditional && !group.conditional(activeFilters)) {
      return null;
    }

    const isExpanded = expandedGroups.has(group.id);
    const currentValue = activeFilters[group.id];
    const hasValue = currentValue !== undefined && currentValue !== null && 
      (Array.isArray(currentValue) ? currentValue.length > 0 : currentValue !== '');

    return (
      <div
        key={group.id}
        className={`border border-gray-200 rounded-lg overflow-hidden ${
          hasValue ? 'ring-2 ring-indigo-100 border-indigo-300' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            {group.icon}
            <h3 className="font-medium text-gray-900">{group.name}</h3>
            {hasValue && (
              <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                Active
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {hasValue && (
              <button
                onClick={() => clearFilter(group.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label={`Clear ${group.name} filter`}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
            
            {group.collapsible && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.name}`}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {(!group.collapsible || isExpanded) && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4">
                {group.type === 'select' && group.options && (
                  <select
                    value={currentValue || ''}
                    onChange={(e) => handleFilterChange(group.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All {group.name}</option>
                    {group.options.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {showCounts && option.count ? ` (${option.count.toLocaleString()})` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {group.type === 'multiselect' && group.options && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {group.options.map(option => (
                      <label key={option.value} className="flex items-center hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={Array.isArray(currentValue) ? currentValue.includes(option.value) : false}
                          onChange={(e) => {
                            const current = Array.isArray(currentValue) ? currentValue : [];
                            const newValue = e.target.checked
                              ? [...current, option.value]
                              : current.filter(v => v !== option.value);
                            handleFilterChange(group.id, newValue.length > 0 ? newValue : undefined);
                          }}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="ml-3 flex items-center space-x-2 flex-1">
                          {option.icon && <span>{option.icon}</span>}
                          <span className="text-sm text-gray-700">{option.label}</span>
                          {showCounts && option.count && (
                            <span className="text-xs text-gray-500">({option.count.toLocaleString()})</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {group.type === 'boolean' && (
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={currentValue || false}
                      onChange={(e) => handleFilterChange(group.id, e.target.checked || undefined)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Enable {group.name}</span>
                  </label>
                )}

                {group.type === 'rating' && (
                  <div>
                    {renderStarRating(
                      ratingValue,
                      (value) => {
                        setRatingValue(value);
                        handleFilterChange(group.id, value > 0 ? value : undefined);
                      },
                      group.max || 5
                    )}
                  </div>
                )}

                {group.type === 'price' && (
                  <div>
                    {renderPriceRange(
                      priceRange,
                      (value) => {
                        setPriceRange(value);
                        handleFilterChange(group.id, value);
                      },
                      group.max || 100
                    )}
                  </div>
                )}

                {group.type === 'range' && (
                  <div>
                    {renderRangeSlider(
                      durationRange,
                      (value) => {
                        setDurationRange(value);
                        handleFilterChange(group.id, value);
                      },
                      group.min || 0,
                      group.max || 7200,
                      group.unit
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const activeFilterCount = getFilterCount();
  const sortedFilters = filters.sort((a, b) => (a.priority || 999) - (b.priority || 999));

  return (
    <div className={`bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {allowSaving && activeFilterCount > 0 && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Filters */}
      {(savedFilters.length > 0 || localSavedFilters.length > 0) && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Saved Filters</h3>
          <div className="flex flex-wrap gap-2">
            {[...savedFilters, ...localSavedFilters].map(filter => (
              <div
                key={filter.id}
                className="flex items-center space-x-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm"
              >
                <button
                  onClick={() => loadFilter(filter)}
                  className="text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  {filter.name}
                </button>
                <button
                  onClick={() => deleteFilter(filter.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Groups */}
      <div
        className="space-y-4 p-4 overflow-y-auto"
        style={{ maxHeight: maxHeight }}
      >
        {sortedFilters.map(renderFilterGroup)}
      </div>

      {/* Save Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Filter</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Name
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Enter a name for this filter..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCurrentFilter}
                  disabled={!filterName.trim()}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Save Filter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}