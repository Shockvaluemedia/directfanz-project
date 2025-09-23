'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  BellOff,
  Save,
  Edit3,
  Trash2,
  Plus,
  Filter,
  Clock,
  Mail,
  Smartphone,
  Globe,
  Star,
  Eye,
  TrendingUp,
  Calendar,
  Settings,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Share,
  Copy,
  MoreHorizontal,
  Tag,
  User,
  Heart,
  Bookmark,
  MessageCircle,
  Zap,
  Target,
  Activity,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  alertEnabled: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly' | 'monthly';
  alertMethods: ('email' | 'push' | 'in-app')[];
  lastTriggered?: Date;
  nextCheck?: Date;
  resultsFound: number;
  newResultsCount: number;
  isActive: boolean;
  createdAt: Date;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  matchedResults: SearchResult[];
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  creator: string;
  matchedAt: Date;
  relevanceScore: number;
}

interface AlertNotification {
  id: string;
  savedSearchId: string;
  savedSearchName: string;
  newResults: SearchResult[];
  triggeredAt: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface SavedSearchesManagerProps {
  onSearch?: (query: string, filters: Record<string, any>) => void;
  onCreateAlert?: (search: SavedSearch) => void;
  className?: string;
}

// Mock data
const mockSavedSearches: SavedSearch[] = [
  {
    id: '1',
    name: 'Fitness Workouts',
    query: 'fitness workout',
    filters: { category: ['fitness'], type: ['video'] },
    alertEnabled: true,
    alertFrequency: 'daily',
    alertMethods: ['email', 'push'],
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    nextCheck: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
    resultsFound: 142,
    newResultsCount: 3,
    isActive: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    tags: ['health', 'exercise'],
    priority: 'high',
    matchedResults: [
      {
        id: 'r1',
        title: '30-Minute HIIT Workout',
        description: 'High-intensity interval training for maximum results',
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
        creator: 'FitnessPro',
        matchedAt: new Date(Date.now() - 30 * 60 * 1000),
        relevanceScore: 0.95
      }
    ]
  },
  {
    id: '2',
    name: 'Cooking Tutorials - Italian',
    query: 'italian cooking tutorial',
    filters: { category: ['cooking'], tags: ['italian'] },
    alertEnabled: true,
    alertFrequency: 'weekly',
    alertMethods: ['in-app'],
    lastTriggered: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    nextCheck: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    resultsFound: 67,
    newResultsCount: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    tags: ['food', 'cuisine'],
    priority: 'medium',
    matchedResults: []
  },
  {
    id: '3',
    name: 'Digital Art Inspiration',
    query: 'digital art procreate',
    filters: { category: ['art'], type: ['video', 'photo'] },
    alertEnabled: false,
    alertFrequency: 'instant',
    alertMethods: ['push'],
    resultsFound: 234,
    newResultsCount: 8,
    isActive: true,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    tags: ['art', 'creativity'],
    priority: 'low',
    matchedResults: []
  }
];

const mockNotifications: AlertNotification[] = [
  {
    id: 'n1',
    savedSearchId: '1',
    savedSearchName: 'Fitness Workouts',
    newResults: [
      {
        id: 'r1',
        title: '30-Minute HIIT Workout',
        description: 'High-intensity interval training for maximum results',
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
        creator: 'FitnessPro',
        matchedAt: new Date(Date.now() - 30 * 60 * 1000),
        relevanceScore: 0.95
      },
      {
        id: 'r2',
        title: 'Morning Yoga Flow',
        description: 'Gentle yoga routine to start your day',
        thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=200&fit=crop',
        creator: 'YogaGuru',
        matchedAt: new Date(Date.now() - 45 * 60 * 1000),
        relevanceScore: 0.87
      }
    ],
    triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isRead: false,
    priority: 'high'
  }
];

export function SavedSearchesManager({
  onSearch,
  onCreateAlert,
  className = ''
}: SavedSearchesManagerProps) {
  const [savedSearches, setSavedSearches] = useLocalStorage<SavedSearch[]>('saved-searches', mockSavedSearches);
  const [notifications, setNotifications] = useLocalStorage<AlertNotification[]>('search-alerts', mockNotifications);
  const [activeTab, setActiveTab] = useState<'searches' | 'alerts' | 'settings'>('searches');
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'priority' | 'activity'>('created');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'alerts' | 'inactive'>('all');

  const { settings } = useAccessibility();
  const { announce } = useScreenReader();

  // Create new saved search
  const createSavedSearch = (searchData: Partial<SavedSearch>) => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchData.name || 'Untitled Search',
      query: searchData.query || '',
      filters: searchData.filters || {},
      alertEnabled: searchData.alertEnabled || false,
      alertFrequency: searchData.alertFrequency || 'daily',
      alertMethods: searchData.alertMethods || ['in-app'],
      resultsFound: 0,
      newResultsCount: 0,
      isActive: true,
      createdAt: new Date(),
      tags: searchData.tags || [],
      priority: searchData.priority || 'medium',
      matchedResults: []
    };

    setSavedSearches(prev => [newSearch, ...prev]);
    announce(`Created saved search "${newSearch.name}"`, 'polite');

    if (onCreateAlert && newSearch.alertEnabled) {
      onCreateAlert(newSearch);
    }

    setShowCreateDialog(false);
  };

  // Update saved search
  const updateSavedSearch = (searchId: string, updates: Partial<SavedSearch>) => {
    setSavedSearches(prev => 
      prev.map(search => 
        search.id === searchId 
          ? { ...search, ...updates }
          : search
      )
    );
    announce('Saved search updated', 'polite');
  };

  // Delete saved search
  const deleteSavedSearch = (searchId: string) => {
    setSavedSearches(prev => prev.filter(search => search.id !== searchId));
    announce('Saved search deleted', 'polite');
  };

  // Toggle alert for search
  const toggleAlert = (searchId: string) => {
    updateSavedSearch(searchId, { 
      alertEnabled: !savedSearches.find(s => s.id === searchId)?.alertEnabled 
    });
  };

  // Run search now
  const runSearchNow = (search: SavedSearch) => {
    if (onSearch) {
      onSearch(search.query, search.filters);
    }
    announce(`Running search for "${search.name}"`, 'polite');
  };

  // Mark notification as read
  const markNotificationRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  // Filter and sort searches
  const filteredSearches = savedSearches
    .filter(search => {
      switch (filterBy) {
        case 'active':
          return search.isActive;
        case 'inactive':
          return !search.isActive;
        case 'alerts':
          return search.alertEnabled;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'activity':
          return (b.newResultsCount || 0) - (a.newResultsCount || 0);
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const unreadNotifications = notifications.filter(n => !n.isRead);

  const renderSearchCard = (search: SavedSearch) => (
    <motion.div
      key={search.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white p-6 rounded-xl shadow-lg border transition-all duration-300 ${
        selectedSearch?.id === search.id 
          ? 'ring-2 ring-indigo-500 border-indigo-300' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => setSelectedSearch(selectedSearch?.id === search.id ? null : search)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-gray-900">{search.name}</h3>
            <div className="flex items-center space-x-1">
              {search.priority === 'high' && (
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              )}
              {search.priority === 'medium' && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              )}
              {search.priority === 'low' && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              {!search.isActive && (
                <div className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                  Paused
                </div>
              )}
            </div>
          </div>
          
          <p className="text-gray-600 text-sm mb-2">"{search.query}"</p>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {search.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAlert(search.id);
            }}
            className={`p-2 rounded-full transition-colors ${
              search.alertEnabled 
                ? 'bg-indigo-100 text-indigo-600' 
                : 'bg-gray-100 text-gray-400'
            }`}
            aria-label={search.alertEnabled ? 'Disable alerts' : 'Enable alerts'}
          >
            {search.alertEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingSearch(search);
              setShowEditDialog(true);
            }}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            aria-label="Edit search"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{search.resultsFound}</div>
          <div className="text-xs text-gray-500">Total Results</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-indigo-600">{search.newResultsCount}</div>
          <div className="text-xs text-gray-500">New Results</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">
            {search.alertEnabled ? search.alertFrequency : 'Off'}
          </div>
          <div className="text-xs text-gray-500">Alert Frequency</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Created {new Date(search.createdAt).toLocaleDateString()}
          {search.lastTriggered && (
            <span className="block">
              Last checked {new Date(search.lastTriggered).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runSearchNow(search);
            }}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            <Search className="w-3 h-3" />
            <span>Search</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteSavedSearch(search.id);
            }}
            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
            aria-label="Delete search"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {selectedSearch?.id === search.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200"
          >
            <h4 className="font-medium text-gray-700 mb-2">Alert Settings</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Methods:</span>
                <div className="flex space-x-2 mt-1">
                  {search.alertMethods.includes('email') && (
                    <span className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      <Mail className="w-3 h-3" />
                      <span>Email</span>
                    </span>
                  )}
                  {search.alertMethods.includes('push') && (
                    <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      <Smartphone className="w-3 h-3" />
                      <span>Push</span>
                    </span>
                  )}
                  {search.alertMethods.includes('in-app') && (
                    <span className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      <Bell className="w-3 h-3" />
                      <span>In-App</span>
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Next Check:</span>
                <div className="font-medium">
                  {search.nextCheck ? new Date(search.nextCheck).toLocaleString() : 'Not scheduled'}
                </div>
              </div>
            </div>

            {search.matchedResults.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Recent Matches</h4>
                <div className="space-y-2">
                  {search.matchedResults.slice(0, 2).map(result => (
                    <div key={result.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                      <img
                        src={result.thumbnail}
                        alt={result.title}
                        className="w-12 h-8 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm text-gray-900 truncate">{result.title}</h5>
                        <p className="text-xs text-gray-500">by {result.creator}</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {Math.round(result.relevanceScore * 100)}% match
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderNotificationCard = (notification: AlertNotification) => (
    <motion.div
      key={notification.id}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-4 border rounded-lg transition-colors ${
        notification.isRead 
          ? 'bg-gray-50 border-gray-200' 
          : 'bg-indigo-50 border-indigo-200'
      }`}
      onClick={() => markNotificationRead(notification.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{notification.savedSearchName}</h4>
          <p className="text-sm text-gray-600">
            {notification.newResults.length} new results found
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(notification.triggeredAt).toLocaleString()}
        </div>
      </div>

      <div className="space-y-2">
        {notification.newResults.slice(0, 3).map(result => (
          <div key={result.id} className="flex items-center space-x-3 p-2 bg-white rounded">
            <img
              src={result.thumbnail}
              alt={result.title}
              className="w-10 h-6 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <h5 className="font-medium text-sm text-gray-900 truncate">{result.title}</h5>
              <p className="text-xs text-gray-500">by {result.creator}</p>
            </div>
          </div>
        ))}
        {notification.newResults.length > 3 && (
          <p className="text-xs text-gray-500 text-center">
            +{notification.newResults.length - 3} more results
          </p>
        )}
      </div>
    </motion.div>
  );

  const tabs = [
    { 
      id: 'searches', 
      label: 'Saved Searches', 
      icon: <Save className="w-4 h-4" />,
      count: savedSearches.length
    },
    { 
      id: 'alerts', 
      label: 'Alert History', 
      icon: <Bell className="w-4 h-4" />,
      count: unreadNotifications.length
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: <Settings className="w-4 h-4" />
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Searches & Alerts</h1>
          <p className="text-gray-600">Manage your saved searches and content alerts</p>
        </div>

        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Search</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'searches' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center space-x-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="created">Sort by Created Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="activity">Sort by Activity</option>
                </select>

                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Searches</option>
                  <option value="active">Active Only</option>
                  <option value="alerts">With Alerts</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="text-sm text-gray-600">
                {filteredSearches.length} of {savedSearches.length} searches
              </div>
            </div>

            {/* Searches Grid */}
            {filteredSearches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSearches.map(renderSearchCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved searches</h3>
                <p className="text-gray-600 mb-4">Create your first saved search to get started</p>
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create Saved Search
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map(renderNotificationCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No alert notifications</h3>
                <p className="text-gray-600">Enable alerts on your saved searches to receive notifications</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-700">Email Notifications</h4>
                    <p className="text-sm text-gray-500">Receive alerts via email</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    defaultChecked
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-700">Push Notifications</h4>
                    <p className="text-sm text-gray-500">Receive alerts on your device</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    defaultChecked
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-700">Sound Notifications</h4>
                    <p className="text-sm text-gray-500">Play sound for new alerts</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Default Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Alert Frequency
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="instant">Instant</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Priority
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create Search Dialog */}
      <AnimatePresence>
        {showCreateDialog && (
          <CreateSearchDialog
            onSave={createSavedSearch}
            onCancel={() => setShowCreateDialog(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit Search Dialog */}
      <AnimatePresence>
        {showEditDialog && editingSearch && (
          <EditSearchDialog
            search={editingSearch}
            onSave={(updates) => {
              updateSavedSearch(editingSearch.id, updates);
              setShowEditDialog(false);
              setEditingSearch(null);
            }}
            onCancel={() => {
              setShowEditDialog(false);
              setEditingSearch(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Create Search Dialog Component
function CreateSearchDialog({
  onSave,
  onCancel
}: {
  onSave: (search: Partial<SavedSearch>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    query: '',
    tags: '',
    alertEnabled: false,
    alertFrequency: 'daily' as SavedSearch['alertFrequency'],
    alertMethods: ['in-app'] as SavedSearch['alertMethods'],
    priority: 'medium' as SavedSearch['priority']
  });

  const handleSave = () => {
    if (!formData.name.trim() || !formData.query.trim()) return;

    onSave({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Saved Search</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter search name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
            <input
              type="text"
              value={formData.query}
              onChange={(e) => setFormData(prev => ({ ...prev, query: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter search terms"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              placeholder="fitness, workout, health"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enableAlerts"
              checked={formData.alertEnabled}
              onChange={(e) => setFormData(prev => ({ ...prev, alertEnabled: e.target.checked }))}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="enableAlerts" className="text-sm text-gray-700">Enable alerts for new results</label>
          </div>

          {formData.alertEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={formData.alertFrequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, alertFrequency: e.target.value as SavedSearch['alertFrequency'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as SavedSearch['priority'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name.trim() || !formData.query.trim()}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Save Search
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Edit Search Dialog Component
function EditSearchDialog({
  search,
  onSave,
  onCancel
}: {
  search: SavedSearch;
  onSave: (updates: Partial<SavedSearch>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: search.name,
    query: search.query,
    tags: search.tags.join(', '),
    alertEnabled: search.alertEnabled,
    alertFrequency: search.alertFrequency,
    alertMethods: search.alertMethods,
    priority: search.priority,
    isActive: search.isActive
  });

  const handleSave = () => {
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Saved Search</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
            <input
              type="text"
              value={formData.query}
              onChange={(e) => setFormData(prev => ({ ...prev, query: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editAlerts"
                checked={formData.alertEnabled}
                onChange={(e) => setFormData(prev => ({ ...prev, alertEnabled: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="editAlerts" className="text-sm text-gray-700">Enable alerts</label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="editActive" className="text-sm text-gray-700">Active</label>
            </div>
          </div>

          {formData.alertEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={formData.alertFrequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, alertFrequency: e.target.value as SavedSearch['alertFrequency'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as SavedSearch['priority'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          {formData.alertEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Alert Methods</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.alertMethods.includes('email')}
                    onChange={(e) => {
                      const methods = e.target.checked
                        ? [...formData.alertMethods, 'email' as const]
                        : formData.alertMethods.filter(m => m !== 'email');
                      setFormData(prev => ({ ...prev, alertMethods: methods }));
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.alertMethods.includes('push')}
                    onChange={(e) => {
                      const methods = e.target.checked
                        ? [...formData.alertMethods, 'push' as const]
                        : formData.alertMethods.filter(m => m !== 'push');
                      setFormData(prev => ({ ...prev, alertMethods: methods }));
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Push Notifications</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.alertMethods.includes('in-app')}
                    onChange={(e) => {
                      const methods = e.target.checked
                        ? [...formData.alertMethods, 'in-app' as const]
                        : formData.alertMethods.filter(m => m !== 'in-app');
                      setFormData(prev => ({ ...prev, alertMethods: methods }));
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">In-App Notifications</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}