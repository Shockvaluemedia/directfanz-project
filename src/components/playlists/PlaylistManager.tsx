'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  Music, 
  Video,
  Play, 
  Pause,
  Heart,
  Share2,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  Lock,
  Users,
  Clock,
  DragHandleDots2Icon,
  GripVertical
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface PlaylistItem {
  id: string;
  position: number;
  addedAt: string;
  content: {
    id: string;
    title: string;
    type: string;
    fileUrl: string;
    thumbnailUrl?: string;
    duration?: number;
    artist: {
      id: string;
      name: string;
      image?: string;
    };
  };
}

interface Playlist {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  coverImage?: string;
  playCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    image?: string;
  };
  items: PlaylistItem[];
  hasLiked?: boolean;
}

interface PlaylistManagerProps {
  initialPlaylists?: Playlist[];
  currentUserId?: string;
  className?: string;
}

export function PlaylistManager({ initialPlaylists = [], currentUserId, className }: PlaylistManagerProps) {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [loading, setLoading] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isPublic: false
  });

  useEffect(() => {
    if (session?.user) {
      fetchPlaylists();
    }
  }, [session?.user]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const userId = currentUserId || session?.user?.id;
      const response = await fetch(`/api/playlists${userId ? `?userId=${userId}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists || []);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!session?.user || !formData.title.trim()) return;

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(prev => [data.playlist, ...prev]);
        setFormData({ title: '', description: '', isPublic: false });
        setShowCreateDialog(false);
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const updatePlaylist = async (playlistId: string, updates: Partial<Playlist>) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(prev => prev.map(p => p.id === playlistId ? data.playlist : p));
        setEditingPlaylist(null);
      }
    } catch (error) {
      console.error('Failed to update playlist:', error);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const toggleLike = async (playlistId: string) => {
    if (!session?.user) return;

    try {
      const playlist = playlists.find(p => p.id === playlistId);
      const method = playlist?.hasLiked ? 'DELETE' : 'POST';
      
      const response = await fetch(`/api/playlists/${playlistId}/like`, {
        method,
      });

      if (response.ok) {
        const { liked, likeCount } = await response.json();
        setPlaylists(prev => prev.map(p => 
          p.id === playlistId 
            ? { ...p, hasLiked: liked, likeCount }
            : p
        ));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const removeFromPlaylist = async (playlistId: string, itemId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPlaylists(prev => prev.map(p => 
          p.id === playlistId 
            ? { ...p, items: p.items.filter(item => item.id !== itemId) }
            : p
        ));
        
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(prev => prev ? {
            ...prev,
            items: prev.items.filter(item => item.id !== itemId)
          } : null);
        }
      }
    } catch (error) {
      console.error('Failed to remove from playlist:', error);
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination || !selectedPlaylist) return;

    const items = Array.from(selectedPlaylist.items);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    const reorderedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));

    // Optimistic update
    const updatedPlaylist = { ...selectedPlaylist, items: reorderedItems };
    setSelectedPlaylist(updatedPlaylist);
    setPlaylists(prev => prev.map(p => p.id === selectedPlaylist.id ? updatedPlaylist : p));

    // Send update to server
    try {
      await fetch(`/api/playlists/${selectedPlaylist.id}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: reorderedItems.map(item => ({ id: item.id, position: item.position }))
        }),
      });
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      // Revert on error
      fetchPlaylists();
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = (playlist: Playlist) => {
    const total = playlist.items.reduce((sum, item) => sum + (item.content.duration || 0), 0);
    return formatDuration(total);
  };

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {playlist.coverImage ? (
              <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
            ) : (
              <Music className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h3 className="font-semibold line-clamp-1 mb-1">{playlist.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {playlist.description || 'No description'}
                </p>
                
                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                  <span>{playlist.items.length} tracks</span>
                  <span>{getTotalDuration(playlist)}</span>
                  {playlist.isPublic ? (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Public
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={playlist.user.image} />
                    <AvatarFallback className="text-xs">
                      {playlist.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{playlist.user.name}</span>
                </div>
              </div>
              
              {session?.user?.id === playlist.user.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setEditingPlaylist(playlist)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deletePlaylist(playlist.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPlaylist(playlist)}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLike(playlist.id)}
                  className={playlist.hasLiked ? 'text-red-500' : ''}
                >
                  <Heart className={`h-4 w-4 mr-1 ${playlist.hasLiked ? 'fill-current' : ''}`} />
                  {playlist.likeCount}
                </Button>
                
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center text-sm text-muted-foreground">
                <Eye className="h-3 w-3 mr-1" />
                {playlist.playCount} plays
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {currentUserId && currentUserId !== session?.user?.id ? 'Playlists' : 'My Playlists'}
          </h2>
          <p className="text-muted-foreground">
            {currentUserId && currentUserId !== session?.user?.id 
              ? 'Discover curated music collections'
              : 'Create and manage your music collections'
            }
          </p>
        </div>
        
        {(!currentUserId || currentUserId === session?.user?.id) && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
                <DialogDescription>
                  Create a new playlist to organize your favorite tracks.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="My Awesome Playlist"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your playlist..."
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
                  />
                  <Label htmlFor="isPublic">Make playlist public</Label>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createPlaylist} disabled={!formData.title.trim()}>
                    Create Playlist
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Playlists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {playlists.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} />
        ))}
        
        {playlists.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No playlists yet</h3>
              <p className="text-muted-foreground mb-4">
                {currentUserId && currentUserId !== session?.user?.id
                  ? 'This user hasn\'t created any public playlists yet.'
                  : 'Create your first playlist to start organizing your favorite tracks.'
                }
              </p>
              {(!currentUserId || currentUserId === session?.user?.id) && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Playlist
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Playlist Detail Modal */}
      <Dialog open={!!selectedPlaylist} onOpenChange={() => setSelectedPlaylist(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Music className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedPlaylist?.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedPlaylist?.items.length} tracks • {selectedPlaylist && getTotalDuration(selectedPlaylist)}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlaylist && (
            <div className="flex-1 overflow-y-auto">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="playlist-items">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {selectedPlaylist.items.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                                snapshot.isDragging ? 'bg-muted shadow-lg' : ''
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                {item.content.thumbnailUrl ? (
                                  <img src={item.content.thumbnailUrl} alt={item.content.title} className="w-full h-full object-cover rounded" />
                                ) : (
                                  <Music className="h-4 w-4" />
                                )}
                              </div>
                              
                              <div className="flex-grow min-w-0">
                                <h4 className="font-medium line-clamp-1">{item.content.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {item.content.artist.name}
                                </p>
                              </div>
                              
                              <div className="text-sm text-muted-foreground">
                                {item.content.duration && formatDuration(item.content.duration)}
                              </div>
                              
                              {session?.user?.id === selectedPlaylist.user.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromPlaylist(selectedPlaylist.id, item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              
              {selectedPlaylist.items.length === 0 && (
                <div className="text-center py-8">
                  <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Playlist is empty</h3>
                  <p className="text-sm text-muted-foreground">
                    Add some tracks to get started!
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}