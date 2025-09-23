'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, 
  BookmarkPlus, 
  Folder, 
  FolderPlus, 
  Lock, 
  Globe, 
  Users, 
  Tag,
  Search,
  Grid,
  List,
  Share2,
  MoreHorizontal,
  Filter,
  Sort,
  Heart,
  Eye,
  X
} from 'lucide-react';

interface BookmarkItem {
  id: string;
  contentId: string;
  title: string;
  thumbnail?: string;
  artistName: string;
  artistAvatar?: string;
  duration?: string;
  addedAt: Date;
  tags: string[];
  collections: string[];
  isPublic: boolean;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  isPublic: boolean;
  itemCount: number;
  createdAt: Date;
  thumbnail?: string;
}

interface BookmarkSystemProps {
  bookmarks: BookmarkItem[];
  collections: Collection[];
  currentUserId?: string;
  onBookmarkItem: (contentId: string, collections: string[]) => Promise<void>;
  onUnbookmarkItem: (contentId: string) => Promise<void>;
  onCreateCollection: (name: string, description: string, isPublic: boolean, color: string) => Promise<void>;
  onUpdateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
  onAddToCollection: (bookmarkId: string, collectionId: string) => Promise<void>;
  onRemoveFromCollection: (bookmarkId: string, collectionId: string) => Promise<void>;
  className?: string;
}

const collectionColors = [
  { name: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },
  { name: 'Purple', value: '#8B5CF6', bg: 'bg-purple-500' },
  { name: 'Pink', value: '#EC4899', bg: 'bg-pink-500' },
  { name: 'Red', value: '#EF4444', bg: 'bg-red-500' },
  { name: 'Orange', value: '#F97316', bg: 'bg-orange-500' },
  { name: 'Yellow', value: '#EAB308', bg: 'bg-yellow-500' },
  { name: 'Green', value: '#10B981', bg: 'bg-green-500' },
  { name: 'Indigo', value: '#6366F1', bg: 'bg-indigo-500' },
];

export function BookmarkSystem({
  bookmarks,
  collections,
  currentUserId,
  onBookmarkItem,
  onUnbookmarkItem,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onAddToCollection,
  onRemoveFromCollection,
  className = ''
}: BookmarkSystemProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkingContent, setBookmarkingContent] = useState<{
    id: string;
    title: string;
    thumbnail?: string;
  } | null>(null);

  // Collection creation form
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    color: collectionColors[0].value,
    isPublic: false
  });

  // Filter bookmarks based on selected collection and search
  const filteredBookmarks = bookmarks.filter(bookmark => {
    const matchesSearch = searchQuery === '' || 
      bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCollection = selectedCollection === null ||
      bookmark.collections.includes(selectedCollection);

    return matchesSearch && matchesCollection;
  });

  const handleCreateCollection = useCallback(async () => {
    if (!newCollection.name.trim()) return;

    try {
      await onCreateCollection(
        newCollection.name,
        newCollection.description,
        newCollection.isPublic,
        newCollection.color
      );
      setNewCollection({
        name: '',
        description: '',
        color: collectionColors[0].value,
        isPublic: false
      });
      setShowCreateCollection(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  }, [newCollection, onCreateCollection]);

  const handleBookmarkContent = useCallback(async (contentId: string, collectionIds: string[]) => {
    try {
      await onBookmarkItem(contentId, collectionIds);
      setShowBookmarkModal(false);
      setBookmarkingContent(null);
    } catch (error) {
      console.error('Failed to bookmark content:', error);
    }
  }, [onBookmarkItem]);

  const BookmarkModal = () => {
    const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
    const [newCollectionName, setNewCollectionName] = useState('');

    const handleCollectionToggle = (collectionId: string) => {
      setSelectedCollections(prev => {
        const newSet = new Set(prev);
        if (newSet.has(collectionId)) {
          newSet.delete(collectionId);
        } else {
          newSet.add(collectionId);
        }
        return newSet;
      });
    };

    const handleQuickCreateCollection = async () => {
      if (!newCollectionName.trim()) return;
      
      try {
        await onCreateCollection(newCollectionName, '', false, collectionColors[0].value);
        setNewCollectionName('');
        // The new collection will appear in the list automatically
      } catch (error) {
        console.error('Failed to create collection:', error);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={() => setShowBookmarkModal(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Save to Collection</h3>
            <button
              onClick={() => setShowBookmarkModal(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {bookmarkingContent && (
            <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0">
                {bookmarkingContent.thumbnail ? (
                  <img 
                    src={bookmarkingContent.thumbnail} 
                    alt={bookmarkingContent.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {bookmarkingContent.title}
                </h4>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <h4 className="font-medium text-gray-900">Select Collections</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {collections.map(collection => (
                <motion.label
                  key={collection.id}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.has(collection.id)}
                    onChange={() => handleCollectionToggle(collection.id)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: collection.color }}
                  />
                  <span className="flex-1 text-gray-900">{collection.name}</span>
                  <span className="text-sm text-gray-500">
                    {collection.itemCount} items
                  </span>
                </motion.label>
              ))}
            </div>

            {/* Quick create new collection */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Create new collection..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <motion.button
                  onClick={handleQuickCreateCollection}
                  disabled={!newCollectionName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 text-sm"
                  whileTap={{ scale: 0.95 }}
                >
                  Create
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <motion.button
              onClick={() => setShowBookmarkModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={() => bookmarkingContent && handleBookmarkContent(
                bookmarkingContent.id,
                Array.from(selectedCollections)
              )}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              whileTap={{ scale: 0.95 }}
            >
              Save
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const CreateCollectionModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => setShowCreateCollection(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Create Collection</h3>
          <button
            onClick={() => setShowCreateCollection(false)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={newCollection.name}
              onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter collection name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={newCollection.description}
              onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Describe your collection..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="grid grid-cols-8 gap-2">
              {collectionColors.map(color => (
                <motion.button
                  key={color.value}
                  onClick={() => setNewCollection(prev => ({ ...prev, color: color.value }))}
                  className={`w-8 h-8 rounded-full ${color.bg} ${
                    newCollection.color === color.value ? 'ring-2 ring-gray-400' : ''
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newCollection.isPublic}
                onChange={(e) => setNewCollection(prev => ({ ...prev, isPublic: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Make this collection public</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Public collections can be viewed and followed by other users
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <motion.button
            onClick={() => setShowCreateCollection(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={handleCreateCollection}
            disabled={!newCollection.name.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300"
            whileTap={{ scale: 0.95 }}
          >
            Create Collection
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">My Bookmarks</h2>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
            {filteredBookmarks.length} items
          </span>
        </div>

        <motion.button
          onClick={() => setShowCreateCollection(true)}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Collection</span>
        </motion.button>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search and Filter */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bookmarks..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>

          <select
            value={selectedCollection || ''}
            onChange={(e) => setSelectedCollection(e.target.value || null)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Collections</option>
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.name} ({collection.itemCount})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode */}
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <motion.button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            whileTap={{ scale: 0.95 }}
          >
            <Grid className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            whileTap={{ scale: 0.95 }}
          >
            <List className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Collections Grid */}
      {collections.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collections</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {collections.map(collection => (
              <motion.div
                key={collection.id}
                onClick={() => setSelectedCollection(
                  selectedCollection === collection.id ? null : collection.id
                )}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedCollection === collection.id 
                    ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                    : 'bg-white hover:shadow-md'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: collection.color }}
                  />
                  <Folder className="w-5 h-5 text-gray-400" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{collection.name}</h4>
                <p className="text-sm text-gray-500">{collection.itemCount} items</p>
                {!collection.isPublic && (
                  <Lock className="w-4 h-4 text-gray-400 mt-2" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Bookmarks Grid/List */}
      <div className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
      }>
        {filteredBookmarks.map(bookmark => (
          <motion.div
            key={bookmark.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-xl shadow-soft hover:shadow-medium transition-all ${
              viewMode === 'list' ? 'flex items-center space-x-4 p-4' : 'overflow-hidden'
            }`}
          >
            {/* Thumbnail */}
            <div className={`bg-gray-200 flex-shrink-0 ${
              viewMode === 'list' ? 'w-16 h-16 rounded-lg' : 'aspect-video rounded-t-xl'
            }`}>
              {bookmark.thumbnail ? (
                <img 
                  src={bookmark.thumbnail} 
                  alt={bookmark.title}
                  className="w-full h-full object-cover rounded-t-xl"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 rounded-t-xl" />
              )}
            </div>

            {/* Content */}
            <div className={viewMode === 'list' ? 'flex-1 min-w-0' : 'p-4'}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 line-clamp-2">
                  {bookmark.title}
                </h4>
                <motion.button
                  className="p-1 hover:bg-gray-100 rounded"
                  whileTap={{ scale: 0.9 }}
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </motion.button>
              </div>

              <p className="text-sm text-gray-600 mb-2">{bookmark.artistName}</p>

              {bookmark.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {bookmark.tags.slice(0, 3).map(tag => (
                    <span 
                      key={tag}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                  {bookmark.tags.length > 3 && (
                    <span className="text-gray-400 text-xs">
                      +{bookmark.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  {bookmark.addedAt.toLocaleDateString()}
                </span>
                {bookmark.isPublic && (
                  <Globe className="w-4 h-4" />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredBookmarks.length === 0 && (
        <div className="text-center py-12">
          <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || selectedCollection 
              ? 'Try adjusting your search or filter criteria'
              : 'Start saving your favorite content to collections'
            }
          </p>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateCollection && <CreateCollectionModal />}
        {showBookmarkModal && <BookmarkModal />}
      </AnimatePresence>
    </div>
  );
}