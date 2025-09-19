// Media Player Type Definitions

export interface LyricLine {
  timestamp: number;
  text: string;
  duration?: number;
}

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  url: string;
  thumbnail?: string;
  lyrics?: LyricLine[];
  genre?: string;
  releaseYear?: number;
  isLiked?: boolean;
  playCount?: number;
  waveform?: number[];
  metadata?: {
    bitrate: number;
    format: string;
    sampleRate: number;
  };
  addedAt?: Date;
  addedBy?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface Playlist {
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

export interface PlaylistFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  playlists: Playlist[];
  createdAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  timestamp: number;
  createdAt: Date;
  likes: number;
  isLiked?: boolean;
}

export interface PlayerState {
  currentTrack: MediaTrack | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  crossfade: number;
  playbackRate: number;
}

export interface VisualizationData {
  frequencies: Uint8Array;
  waveform: Uint8Array;
  peak: number;
  rms: number;
}

export interface SmartPlaylistRule {
  field: 'genre' | 'artist' | 'album' | 'year' | 'playCount' | 'duration' | 'dateAdded';
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'inRange';
  value: string | number | [number, number];
}

export interface SmartPlaylist {
  id: string;
  name: string;
  rules: SmartPlaylistRule[];
  limit?: number;
  sortBy: 'name' | 'artist' | 'dateAdded' | 'playCount' | 'duration' | 'random';
  sortOrder: 'asc' | 'desc';
  autoUpdate: boolean;
}
