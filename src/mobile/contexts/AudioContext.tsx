/**
 * Audio Context for Mobile App
 *
 * This context provides global audio state management for the React Native app including:
 * - Current track and queue management
 * - Playback state synchronization
 * - Cross-component audio controls
 * - Offline playback state
 * - Audio session management
 * - Background playback coordination
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import audioService, { AudioTrack, PlaybackState } from '../services/AudioService';
import { AppState } from 'react-native';

// Types
export interface AudioContextState {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'track' | 'repeat';
  isOfflineMode: boolean;
  downloadedTracks: string[];
  error: string | null;
}

export interface AudioContextActions {
  // Playback controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  seekTo: (position: number) => void;
  setVolume: (volume: number) => void;

  // Queue management
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void;
  addToQueue: (tracks: AudioTrack[]) => void;
  removeFromQueue: (trackId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;

  // Playback modes
  toggleShuffle: () => void;
  setRepeatMode: (mode: 'off' | 'track' | 'repeat') => void;

  // Offline support
  downloadTrack: (trackId: string) => Promise<void>;
  removeDownload: (trackId: string) => Promise<void>;
  toggleOfflineMode: () => void;

  // Error handling
  clearError: () => void;
}

export type AudioContextValue = AudioContextState & AudioContextActions;

// Action types
type AudioAction =
  | { type: 'SET_CURRENT_TRACK'; payload: AudioTrack | null }
  | { type: 'SET_QUEUE'; payload: AudioTrack[] }
  | { type: 'SET_CURRENT_INDEX'; payload: number }
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_IS_SHUFFLED'; payload: boolean }
  | { type: 'SET_REPEAT_MODE'; payload: 'off' | 'track' | 'repeat' }
  | { type: 'SET_OFFLINE_MODE'; payload: boolean }
  | { type: 'SET_DOWNLOADED_TRACKS'; payload: string[] }
  | { type: 'ADD_DOWNLOADED_TRACK'; payload: string }
  | { type: 'REMOVE_DOWNLOADED_TRACK'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_TO_QUEUE'; payload: AudioTrack[] }
  | { type: 'REMOVE_FROM_QUEUE'; payload: string }
  | { type: 'REORDER_QUEUE'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'UPDATE_PLAYBACK_STATE'; payload: PlaybackState };

// Initial state
const initialState: AudioContextState = {
  currentTrack: null,
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  isLoading: false,
  progress: 0,
  duration: 0,
  volume: 1,
  isShuffled: false,
  repeatMode: 'off',
  isOfflineMode: false,
  downloadedTracks: [],
  error: null,
};

// Reducer
function audioReducer(state: AudioContextState, action: AudioAction): AudioContextState {
  switch (action.type) {
    case 'SET_CURRENT_TRACK':
      return { ...state, currentTrack: action.payload };

    case 'SET_QUEUE':
      return { ...state, queue: action.payload };

    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.payload };

    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.payload };

    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };

    case 'SET_DURATION':
      return { ...state, duration: action.payload };

    case 'SET_VOLUME':
      return { ...state, volume: action.payload };

    case 'SET_IS_SHUFFLED':
      return { ...state, isShuffled: action.payload };

    case 'SET_REPEAT_MODE':
      return { ...state, repeatMode: action.payload };

    case 'SET_OFFLINE_MODE':
      return { ...state, isOfflineMode: action.payload };

    case 'SET_DOWNLOADED_TRACKS':
      return { ...state, downloadedTracks: action.payload };

    case 'ADD_DOWNLOADED_TRACK':
      return {
        ...state,
        downloadedTracks: [...state.downloadedTracks, action.payload],
      };

    case 'REMOVE_DOWNLOADED_TRACK':
      return {
        ...state,
        downloadedTracks: state.downloadedTracks.filter(id => id !== action.payload),
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, ...action.payload] };

    case 'REMOVE_FROM_QUEUE':
      const newQueue = state.queue.filter(track => track.id !== action.payload);
      let newIndex = state.currentIndex;

      // Adjust current index if necessary
      const removedIndex = state.queue.findIndex(track => track.id === action.payload);
      if (removedIndex !== -1 && removedIndex < state.currentIndex) {
        newIndex = state.currentIndex - 1;
      } else if (removedIndex === state.currentIndex) {
        newIndex = Math.min(state.currentIndex, newQueue.length - 1);
      }

      return {
        ...state,
        queue: newQueue,
        currentIndex: newIndex,
        currentTrack: newQueue[newIndex] || null,
      };

    case 'REORDER_QUEUE':
      const { fromIndex, toIndex } = action.payload;
      const reorderedQueue = [...state.queue];
      const [movedItem] = reorderedQueue.splice(fromIndex, 1);
      reorderedQueue.splice(toIndex, 0, movedItem);

      // Update current index if the current track was moved
      let updatedIndex = state.currentIndex;
      if (fromIndex === state.currentIndex) {
        updatedIndex = toIndex;
      } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        updatedIndex = state.currentIndex - 1;
      } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        updatedIndex = state.currentIndex + 1;
      }

      return {
        ...state,
        queue: reorderedQueue,
        currentIndex: updatedIndex,
      };

    case 'CLEAR_QUEUE':
      return {
        ...state,
        queue: [],
        currentIndex: 0,
        currentTrack: null,
      };

    case 'UPDATE_PLAYBACK_STATE':
      return {
        ...state,
        currentTrack: action.payload.currentTrack,
        queue: action.payload.queue,
        currentIndex: action.payload.currentIndex,
        isPlaying: action.payload.isPlaying,
        isLoading: action.payload.isLoading,
        progress: action.payload.progress,
        duration: action.payload.duration,
        volume: action.payload.volume,
        isShuffled: action.payload.isShuffled,
        repeatMode: action.payload.repeatMode,
      };

    default:
      return state;
  }
}

// Context
const AudioContext = createContext<AudioContextValue | undefined>(undefined);

// Provider props
interface AudioProviderProps {
  children: ReactNode;
}

// Provider component
export function AudioProvider({ children }: AudioProviderProps) {
  const [state, dispatch] = useReducer(audioReducer, initialState);

  // Effects
  useEffect(() => {
    // Initialize audio service and load persisted state
    const initializeAudio = async () => {
      try {
        const initialState = audioService.getState();
        dispatch({ type: 'UPDATE_PLAYBACK_STATE', payload: initialState });

        // Load downloaded tracks
        const downloaded = await audioService.getDownloadedTracks();
        dispatch({ type: 'SET_DOWNLOADED_TRACKS', payload: downloaded });
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize audio system' });
      }
    };

    initializeAudio();

    // Listen to audio service events
    const handlePlaybackStateChanged = (newState: PlaybackState) => {
      dispatch({ type: 'UPDATE_PLAYBACK_STATE', payload: newState });
    };

    const handleTrackChanged = (newState: PlaybackState) => {
      dispatch({ type: 'SET_CURRENT_TRACK', payload: newState.currentTrack });
      dispatch({ type: 'SET_CURRENT_INDEX', payload: newState.currentIndex });
    };

    const handleError = (error: string) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    };

    const handleDownloadComplete = (trackId: string) => {
      dispatch({ type: 'ADD_DOWNLOADED_TRACK', payload: trackId });
    };

    audioService.on('playbackStateChanged', handlePlaybackStateChanged);
    audioService.on('trackChanged', handleTrackChanged);
    audioService.on('error', handleError);
    audioService.on('downloadComplete', handleDownloadComplete);

    return () => {
      audioService.off('playbackStateChanged', handlePlaybackStateChanged);
      audioService.off('trackChanged', handleTrackChanged);
      audioService.off('error', handleError);
      audioService.off('downloadComplete', handleDownloadComplete);
    };
  }, []);

  useEffect(() => {
    // Handle app state changes for background playback
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        // App going to background - audio service handles background playback
        console.log('App entering background, audio continuing...');
      } else if (nextAppState === 'active') {
        // App coming to foreground - sync state
        const currentState = audioService.getState();
        dispatch({ type: 'UPDATE_PLAYBACK_STATE', payload: currentState });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Actions
  const actions: AudioContextActions = {
    // Playback controls
    play: () => {
      audioService.play();
    },

    pause: () => {
      audioService.pause();
    },

    stop: () => {
      audioService.stop();
    },

    skipToNext: () => {
      audioService.skipToNext();
    },

    skipToPrevious: () => {
      audioService.skipToPrevious();
    },

    seekTo: (position: number) => {
      audioService.seekTo(position);
    },

    setVolume: (volume: number) => {
      audioService.setVolume(volume);
      dispatch({ type: 'SET_VOLUME', payload: volume });
    },

    // Queue management
    playTrack: (track: AudioTrack, queue?: AudioTrack[]) => {
      const newQueue = queue || [track];
      const index = newQueue.findIndex(t => t.id === track.id);

      audioService.setQueue(newQueue, index);
      audioService.play();

      dispatch({ type: 'SET_QUEUE', payload: newQueue });
      dispatch({ type: 'SET_CURRENT_INDEX', payload: index });
      dispatch({ type: 'SET_CURRENT_TRACK', payload: track });
    },

    addToQueue: (tracks: AudioTrack[]) => {
      const filteredTracks = tracks.filter(
        track => !state.isOfflineMode || state.downloadedTracks.includes(track.id)
      );

      audioService.addToQueue(filteredTracks);
      dispatch({ type: 'ADD_TO_QUEUE', payload: filteredTracks });
    },

    removeFromQueue: (trackId: string) => {
      audioService.removeFromQueue(trackId);
      dispatch({ type: 'REMOVE_FROM_QUEUE', payload: trackId });
    },

    reorderQueue: (fromIndex: number, toIndex: number) => {
      audioService.reorderQueue(fromIndex, toIndex);
      dispatch({ type: 'REORDER_QUEUE', payload: { fromIndex, toIndex } });
    },

    clearQueue: () => {
      audioService.clearQueue();
      dispatch({ type: 'CLEAR_QUEUE' });
    },

    // Playback modes
    toggleShuffle: () => {
      audioService.toggleShuffle();
      dispatch({ type: 'SET_IS_SHUFFLED', payload: !state.isShuffled });
    },

    setRepeatMode: (mode: 'off' | 'track' | 'repeat') => {
      audioService.setRepeatMode(mode);
      dispatch({ type: 'SET_REPEAT_MODE', payload: mode });
    },

    // Offline support
    downloadTrack: async (trackId: string) => {
      try {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        await audioService.downloadTrack(trackId);
        dispatch({ type: 'ADD_DOWNLOADED_TRACK', payload: trackId });
      } catch (error) {
        console.error('Failed to download track:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to download track' });
      } finally {
        dispatch({ type: 'SET_IS_LOADING', payload: false });
      }
    },

    removeDownload: async (trackId: string) => {
      try {
        await audioService.removeDownload(trackId);
        dispatch({ type: 'REMOVE_DOWNLOADED_TRACK', payload: trackId });
      } catch (error) {
        console.error('Failed to remove download:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to remove download' });
      }
    },

    toggleOfflineMode: () => {
      const newOfflineMode = !state.isOfflineMode;
      audioService.setOfflineMode(newOfflineMode);
      dispatch({ type: 'SET_OFFLINE_MODE', payload: newOfflineMode });

      if (newOfflineMode) {
        // Filter queue to only downloaded tracks
        const offlineQueue = state.queue.filter(track => state.downloadedTracks.includes(track.id));
        dispatch({ type: 'SET_QUEUE', payload: offlineQueue });

        // Update current track if needed
        if (state.currentTrack && !state.downloadedTracks.includes(state.currentTrack.id)) {
          const newCurrentTrack = offlineQueue[0] || null;
          dispatch({ type: 'SET_CURRENT_TRACK', payload: newCurrentTrack });
          dispatch({ type: 'SET_CURRENT_INDEX', payload: newCurrentTrack ? 0 : -1 });
        }
      }
    },

    // Error handling
    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },
  };

  const contextValue: AudioContextValue = {
    ...state,
    ...actions,
  };

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>;
}

// Hook
export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export default AudioContext;
