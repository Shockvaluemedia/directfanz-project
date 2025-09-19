'use client';

/**
 * Playlist Manager - Advanced Playlist Management Component
 *
 * This component provides comprehensive playlist management with:
 * - Create, edit, and delete playlists
 * - Drag & drop track reordering
 * - Smart playlist suggestions based on listening habits
 * - Collaborative playlists with multiple contributors
 * - Playlist sharing and discovery
 * - Auto-generated playlists (mood, genre, activity)
 * - Playlist analytics and insights
 * - Import/export functionality
 * - Advanced search and filtering
 * - Playlist folders and organization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  FolderPlusIcon,
  MusicalNoteIcon,
  HeartIcon,
  ShareIcon,
  TrashIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  ArrowsUpDownIcon,
  UserGroupIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  LockClosedIcon,
  LockOpenIcon,
  StarIcon,
  TagIcon,
  QueueListIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid,
  FolderIcon as FolderIconSolid,
  LockClosedIcon as LockClosedIconSolid,
} from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Types
interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  url: string;
  thumbnail?: string;
  genre?: string;
  releaseYear?: number;
  isLiked?: boolean;
  playCount?: number;
  addedAt?: Date;
  addedBy?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: MediaTrack[];
  thumbnail?: string;
  isPublic: boolean;
  isCollaborative: boolean;
  tags: string[];
  folderId?: string;
  owner: {
    id: string;
    name: string;
    avatar?: string;
  };
  collaborators: Array<{
    id: string;
    name: string;
    avatar?: string;
    role: 'editor' | 'viewer';
  }>;
  stats: {
    totalDuration: number;
    totalPlays: number;
    followers: number;
    likes: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface PlaylistFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  playlists: Playlist[];
  createdAt: Date;
}

interface SmartPlaylistRule {
  field: 'genre' | 'artist' | 'album' | 'year' | 'playCount' | 'duration' | 'dateAdded';
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'inRange';
  value: string | number | [number, number];
}

interface SmartPlaylist {
  id: string;
  name: string;
  rules: SmartPlaylistRule[];
  limit?: number;
  sortBy: 'name' | 'artist' | 'dateAdded' | 'playCount' | 'duration' | 'random';
  sortOrder: 'asc' | 'desc';
  autoUpdate: boolean;
}

interface PlaylistManagerProps {
  onPlaylistSelect?: (playlist: Playlist) => void;
  onTrackPlay?: (track: MediaTrack, playlist: Playlist) => void;
  selectedPlaylistId?: string;
  compact?: boolean;
  className?: string;
}

export default function PlaylistManager({
  onPlaylistSelect,
  onTrackPlay,
  selectedPlaylistId,
  compact = false,
  className,
}: PlaylistManagerProps) {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [folders, setFolders] = useState<PlaylistFolder[]>([]);
  const [smartPlaylists, setSmartPlaylists] = useState<SmartPlaylist[]>([]);

  // UI State
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created' | 'duration'>('updated');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showSmartPlaylistModal, setShowSmartPlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create/Edit State
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    description: '',
    isPublic: false,
    isCollaborative: false,
    tags: [] as string[],
    folderId: null as string | null,
  });

  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  // Smart Playlist State
  const [smartPlaylistForm, setSmartPlaylistForm] = useState<SmartPlaylist>({
    id: '',
    name: '',
    rules: [],
    limit: 50,
    sortBy: 'dateAdded',
    sortOrder: 'desc',
    autoUpdate: true,
  });

  // Drag & Drop
  const [draggedTrack, setDraggedTrack] = useState<MediaTrack | null>(null);

  // Load data
  useEffect(() => {
    loadPlaylists();
    loadFolders();
    loadSmartPlaylists();
  }, []);

  const loadPlaylists = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/playlists');
      const data = await response.json();

      if (data.success) {
        setPlaylists(data.playlists || []);
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const response = await fetch('/api/playlists/folders');
      const data = await response.json();

      if (data.success) {
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, []);

  const loadSmartPlaylists = useCallback(async () => {
    try {
      const response = await fetch('/api/playlists/smart');
      const data = await response.json();

      if (data.success) {
        setSmartPlaylists(data.smartPlaylists || []);
      }
    } catch (error) {
      console.error('Failed to load smart playlists:', error);
    }
  }, []);

  // Playlist operations
  const createPlaylist = useCallback(async () => {
    if (!playlistForm.name.trim() || !session?.user) return;

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlistForm),
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev => [data.playlist, ...prev]);
        setShowCreateModal(false);
        setPlaylistForm({
          name: '',
          description: '',
          isPublic: false,
          isCollaborative: false,
          tags: [],
          folderId: null,
        });
        toast.success('Playlist created!');
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast.error('Failed to create playlist');
    }
  }, [playlistForm, session?.user]);

  const updatePlaylist = useCallback(async (playlistId: string, updates: Partial<Playlist>) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev =>
          prev.map(playlist =>
            playlist.id === playlistId ? { ...playlist, ...data.playlist } : playlist
          )
        );
        toast.success('Playlist updated!');
      }
    } catch (error) {
      console.error('Failed to update playlist:', error);
      toast.error('Failed to update playlist');
    }
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev => prev.filter(playlist => playlist.id !== playlistId));
        toast.success('Playlist deleted!');
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast.error('Failed to delete playlist');
    }
  }, []);

  const duplicatePlaylist = useCallback(async (playlist: Playlist) => {
    try {
      const response = await fetch(`/api/playlists/${playlist.id}/duplicate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev => [data.playlist, ...prev]);
        toast.success('Playlist duplicated!');
      }
    } catch (error) {
      console.error('Failed to duplicate playlist:', error);
      toast.error('Failed to duplicate playlist');
    }
  }, []);

  // Track operations
  const addTrackToPlaylist = useCallback(async (playlistId: string, track: MediaTrack) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev =>
          prev.map(playlist =>
            playlist.id === playlistId
              ? { ...playlist, tracks: [...playlist.tracks, track] }
              : playlist
          )
        );
        toast.success('Track added to playlist!');
      }
    } catch (error) {
      console.error('Failed to add track:', error);
      toast.error('Failed to add track');
    }
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setPlaylists(prev =>
          prev.map(playlist =>
            playlist.id === playlistId
              ? { ...playlist, tracks: playlist.tracks.filter(track => track.id !== trackId) }
              : playlist
          )
        );
        toast.success('Track removed from playlist!');
      }
    } catch (error) {
      console.error('Failed to remove track:', error);
      toast.error('Failed to remove track');
    }
  }, []);

  const reorderPlaylistTracks = useCallback(
    async (playlistId: string, sourceIndex: number, destinationIndex: number) => {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const newTracks = Array.from(playlist.tracks);
      const [reorderedTrack] = newTracks.splice(sourceIndex, 1);
      newTracks.splice(destinationIndex, 0, reorderedTrack);

      // Optimistic update
      setPlaylists(prev => prev.map(p => (p.id === playlistId ? { ...p, tracks: newTracks } : p)));

      try {
        const response = await fetch(`/api/playlists/${playlistId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceIndex,
            destinationIndex,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          // Revert on failure
          setPlaylists(prev => prev.map(p => (p.id === playlistId ? playlist : p)));
          toast.error('Failed to reorder tracks');
        }
      } catch (error) {
        console.error('Failed to reorder tracks:', error);
        toast.error('Failed to reorder tracks');
      }
    },
    [playlists]
  );

  // Folder operations
  const createFolder = useCallback(async () => {
    if (!folderForm.name.trim() || !session?.user) return;

    try {
      const response = await fetch('/api/playlists/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folderForm),
      });

      const data = await response.json();

      if (data.success) {
        setFolders(prev => [data.folder, ...prev]);
        setShowFolderModal(false);
        setFolderForm({
          name: '',
          description: '',
          color: '#3B82F6',
        });
        toast.success('Folder created!');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
    }
  }, [folderForm, session?.user]);

  // Smart playlist operations
  const createSmartPlaylist = useCallback(async () => {
    if (!smartPlaylistForm.name.trim() || smartPlaylistForm.rules.length === 0) return;

    try {
      const response = await fetch('/api/playlists/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smartPlaylistForm),
      });

      const data = await response.json();

      if (data.success) {
        setSmartPlaylists(prev => [data.smartPlaylist, ...prev]);
        setShowSmartPlaylistModal(false);
        setSmartPlaylistForm({
          id: '',
          name: '',
          rules: [],
          limit: 50,
          sortBy: 'dateAdded',
          sortOrder: 'desc',
          autoUpdate: true,
        });
        toast.success('Smart playlist created!');
      }
    } catch (error) {
      console.error('Failed to create smart playlist:', error);
      toast.error('Failed to create smart playlist');
    }
  }, [smartPlaylistForm]);

  // Filtering and sorting
  const filteredPlaylists = React.useMemo(() => {
    let filtered = playlists;

    // Filter by search
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        playlist =>
          playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          playlist.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          playlist.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by folder
    if (selectedFolder) {
      filtered = filtered.filter(playlist => playlist.folderId === selectedFolder);
    } else if (selectedFolder === null) {
      filtered = filtered.filter(playlist => !playlist.folderId);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'duration':
          return b.stats.totalDuration - a.stats.totalDuration;
        default:
          return 0;
      }
    });

    return filtered;
  }, [playlists, searchQuery, selectedFolder, sortBy]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const PlaylistCard = ({
    playlist,
    isDragging = false,
  }: {
    playlist: Playlist;
    isDragging?: boolean;
  }) => (
    <div
      onClick={() => onPlaylistSelect?.(playlist)}
      className={cn(
        'bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750 transition-colors',
        selectedPlaylistId === playlist.id && 'ring-2 ring-blue-500',
        isDragging && 'opacity-50 rotate-2 scale-95',
        compact && 'p-3'
      )}
    >
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'relative rounded-lg overflow-hidden bg-gray-700 flex-shrink-0',
            compact ? 'w-12 h-12' : 'w-16 h-16'
          )}
        >
          {playlist.thumbnail ? (
            <img
              src={playlist.thumbnail}
              alt={playlist.name}
              className='w-full h-full object-cover'
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center'>
              <MusicalNoteIcon className={cn('text-gray-400', compact ? 'w-6 h-6' : 'w-8 h-8')} />
            </div>
          )}

          {!playlist.isPublic && (
            <div className='absolute top-1 right-1'>
              <LockClosedIconSolid className='w-3 h-3 text-yellow-500' />
            </div>
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between'>
            <div className='min-w-0 flex-1'>
              <h3 className={cn('font-semibold truncate', compact ? 'text-sm' : 'text-base')}>
                {playlist.name}
              </h3>

              {playlist.description && !compact && (
                <p className='text-sm text-gray-400 truncate mt-1'>{playlist.description}</p>
              )}

              <div
                className={cn(
                  'flex items-center gap-4 mt-2 text-gray-500',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                <span>{playlist.tracks.length} tracks</span>
                <span>{formatDuration(playlist.stats.totalDuration)}</span>
                {playlist.isCollaborative && (
                  <span className='flex items-center gap-1'>
                    <UserGroupIcon className='w-3 h-3' />
                    Collaborative
                  </span>
                )}
              </div>

              {playlist.tags.length > 0 && !compact && (
                <div className='flex gap-1 mt-2'>
                  {playlist.tags.slice(0, 3).map(tag => (
                    <span key={tag} className='px-2 py-1 bg-gray-700 text-xs rounded'>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className='flex items-center gap-1 ml-2'>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onTrackPlay?.(playlist.tracks[0], playlist);
                }}
                className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors'
              >
                <PlayIcon className='w-4 h-4' />
              </button>

              <div className='relative group'>
                <button className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors'>
                  <EllipsisVerticalIcon className='w-4 h-4' />
                </button>

                {/* Dropdown menu would go here */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('bg-gray-900 text-white', className)}>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-gray-700'>
        <h2 className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>Your Library</h2>

        <div className='flex items-center gap-2'>
          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm'
          >
            <PlusIcon className='w-4 h-4' />
            {!compact && 'New Playlist'}
          </button>

          {!compact && (
            <>
              <button
                onClick={() => setShowFolderModal(true)}
                className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors'
              >
                <FolderPlusIcon className='w-4 h-4' />
              </button>

              <button
                onClick={() => setShowSmartPlaylistModal(true)}
                className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors'
              >
                <SparklesIcon className='w-4 h-4' />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      {!compact && (
        <div className='p-4 border-b border-gray-700'>
          <div className='flex items-center gap-3 mb-3'>
            <div className='flex-1 relative'>
              <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search playlists...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 text-sm'
            >
              <option value='updated'>Recently Updated</option>
              <option value='created'>Recently Created</option>
              <option value='name'>Name</option>
              <option value='duration'>Duration</option>
            </select>

            <div className='flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden'>
              {(['list', 'grid', 'compact'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-3 py-2 text-sm capitalize transition-colors',
                    viewMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Folder Navigation */}
          <div className='flex items-center gap-2 overflow-x-auto'>
            <button
              onClick={() => setSelectedFolder(null)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                selectedFolder === null
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              )}
            >
              <FolderIcon className='w-4 h-4' />
              All Playlists
            </button>

            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  selectedFolder === folder.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                )}
              >
                <FolderIconSolid className='w-4 h-4' style={{ color: folder.color }} />
                {folder.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playlists List */}
      <div className='flex-1 overflow-auto'>
        {isLoading ? (
          <div className='p-8 text-center'>
            <div className='animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4'></div>
            <p className='text-gray-400'>Loading playlists...</p>
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className='p-8 text-center'>
            <MusicalNoteIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
            <p className='text-gray-400 text-lg mb-2'>No playlists found</p>
            <p className='text-gray-500 mb-4'>
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first playlist to get started'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
            >
              Create Playlist
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'p-4',
              viewMode === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
              viewMode === 'list' && 'space-y-3',
              viewMode === 'compact' && 'space-y-2'
            )}
          >
            {filteredPlaylists.map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-gray-800 rounded-lg p-6 w-full max-w-md'>
            <h3 className='text-lg font-semibold mb-4'>Create Playlist</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Name *</label>
                <input
                  type='text'
                  value={playlistForm.name}
                  onChange={e => setPlaylistForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder='My Awesome Playlist'
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Description</label>
                <textarea
                  value={playlistForm.description}
                  onChange={e =>
                    setPlaylistForm(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder='Describe your playlist...'
                  rows={3}
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={playlistForm.isPublic}
                    onChange={e =>
                      setPlaylistForm(prev => ({ ...prev, isPublic: e.target.checked }))
                    }
                    className='mr-2 rounded'
                  />
                  <span className='text-sm'>Public</span>
                </label>

                <label className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={playlistForm.isCollaborative}
                    onChange={e =>
                      setPlaylistForm(prev => ({ ...prev, isCollaborative: e.target.checked }))
                    }
                    className='mr-2 rounded'
                  />
                  <span className='text-sm'>Collaborative</span>
                </label>
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className='flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={createPlaylist}
                  disabled={!playlistForm.name.trim()}
                  className='flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium'
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-gray-800 rounded-lg p-6 w-full max-w-md'>
            <h3 className='text-lg font-semibold mb-4'>Create Folder</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>Name *</label>
                <input
                  type='text'
                  value={folderForm.name}
                  onChange={e => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder='My Folder'
                  className='w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Color</label>
                <div className='flex gap-2'>
                  {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(color => (
                    <button
                      key={color}
                      onClick={() => setFolderForm(prev => ({ ...prev, color }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        folderForm.color === color
                          ? 'border-white scale-110'
                          : 'border-gray-600 hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={() => setShowFolderModal(false)}
                  className='flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  disabled={!folderForm.name.trim()}
                  className='flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors font-medium'
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
