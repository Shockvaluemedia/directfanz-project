import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface MediaItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  artwork?: string;
  type: 'audio' | 'video';
}

interface PlayerState {
  currentItem: MediaItem | null;
  playlist: MediaItem[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffleMode: boolean;
  volume: number;
  error: string | null;
}

type PlayerAction =
  | { type: 'SET_CURRENT_ITEM'; payload: MediaItem }
  | {
      type: 'SET_PLAYLIST';
      payload: { items: MediaItem[]; startIndex?: number };
    }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SET_POSITION'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REPEAT_MODE'; payload: 'off' | 'one' | 'all' }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

const initialState: PlayerState = {
  currentItem: null,
  playlist: [],
  currentIndex: -1,
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  repeatMode: 'off',
  shuffleMode: false,
  volume: 1.0,
  error: null,
};

const playerReducer = (
  state: PlayerState,
  action: PlayerAction,
): PlayerState => {
  switch (action.type) {
    case 'SET_CURRENT_ITEM':
      return {
        ...state,
        currentItem: action.payload,
        error: null,
      };
    case 'SET_PLAYLIST':
      const { items, startIndex = 0 } = action.payload;
      return {
        ...state,
        playlist: items,
        currentIndex: startIndex,
        currentItem: items[startIndex] || null,
        error: null,
      };
    case 'PLAY':
      return {
        ...state,
        isPlaying: true,
        error: null,
      };
    case 'PAUSE':
      return {
        ...state,
        isPlaying: false,
      };
    case 'STOP':
      return {
        ...state,
        isPlaying: false,
        position: 0,
      };
    case 'NEXT':
      let nextIndex = state.currentIndex + 1;
      if (state.shuffleMode) {
        // Simple shuffle: random index
        nextIndex = Math.floor(Math.random() * state.playlist.length);
      } else if (nextIndex >= state.playlist.length) {
        nextIndex = state.repeatMode === 'all' ? 0 : state.currentIndex;
      }

      return {
        ...state,
        currentIndex: nextIndex,
        currentItem: state.playlist[nextIndex] || state.currentItem,
        position: 0,
      };
    case 'PREVIOUS':
      let prevIndex = state.currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = state.repeatMode === 'all' ? state.playlist.length - 1 : 0;
      }

      return {
        ...state,
        currentIndex: prevIndex,
        currentItem: state.playlist[prevIndex] || state.currentItem,
        position: 0,
      };
    case 'SET_POSITION':
      return {
        ...state,
        position: action.payload,
      };
    case 'SET_DURATION':
      return {
        ...state,
        duration: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_REPEAT_MODE':
      return {
        ...state,
        repeatMode: action.payload,
      };
    case 'TOGGLE_SHUFFLE':
      return {
        ...state,
        shuffleMode: !state.shuffleMode,
      };
    case 'SET_VOLUME':
      return {
        ...state,
        volume: Math.max(0, Math.min(1, action.payload)),
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

interface PlayerContextType extends PlayerState {
  play: (item?: MediaItem) => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (position: number) => void;
  setPlaylist: (items: MediaItem[], startIndex?: number) => void;
  addToPlaylist: (item: MediaItem) => void;
  removeFromPlaylist: (itemId: string) => void;
  setRepeatMode: (mode: 'off' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setVolume: (volume: number) => void;
  clearError: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);

  // Mock audio player implementation
  // In a real app, you would integrate with react-native-sound or similar
  const mockPlayer = {
    play: () => {
      console.log('Playing:', state.currentItem?.title);
      dispatch({ type: 'PLAY' });
    },
    pause: () => {
      console.log('Pausing playback');
      dispatch({ type: 'PAUSE' });
    },
    stop: () => {
      console.log('Stopping playback');
      dispatch({ type: 'STOP' });
    },
    seekTo: (position: number) => {
      console.log('Seeking to:', position);
      dispatch({ type: 'SET_POSITION', payload: position });
    },
  };

  const play = (item?: MediaItem) => {
    if (item) {
      dispatch({ type: 'SET_CURRENT_ITEM', payload: item });
    }
    dispatch({ type: 'SET_LOADING', payload: true });

    // Mock loading delay
    setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false });
      mockPlayer.play();
    }, 500);
  };

  const pause = () => {
    mockPlayer.pause();
  };

  const stop = () => {
    mockPlayer.stop();
  };

  const next = () => {
    if (state.playlist.length > 0) {
      dispatch({ type: 'NEXT' });
    }
  };

  const previous = () => {
    if (state.playlist.length > 0) {
      dispatch({ type: 'PREVIOUS' });
    }
  };

  const seekTo = (position: number) => {
    mockPlayer.seekTo(position);
  };

  const setPlaylist = (items: MediaItem[], startIndex?: number) => {
    dispatch({
      type: 'SET_PLAYLIST',
      payload: { items, startIndex },
    });
  };

  const addToPlaylist = (item: MediaItem) => {
    const newPlaylist = [...state.playlist, item];
    dispatch({
      type: 'SET_PLAYLIST',
      payload: { items: newPlaylist, startIndex: state.currentIndex },
    });
  };

  const removeFromPlaylist = (itemId: string) => {
    const newPlaylist = state.playlist.filter(item => item.id !== itemId);
    const currentItem = state.currentItem;
    let newIndex = state.currentIndex;

    if (currentItem && currentItem.id === itemId) {
      newIndex = Math.min(newIndex, newPlaylist.length - 1);
    }

    dispatch({
      type: 'SET_PLAYLIST',
      payload: { items: newPlaylist, startIndex: newIndex },
    });
  };

  const setRepeatMode = (mode: 'off' | 'one' | 'all') => {
    dispatch({ type: 'SET_REPEAT_MODE', payload: mode });
  };

  const toggleShuffle = () => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Mock position updates during playback
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (state.isPlaying && state.currentItem) {
      interval = setInterval(() => {
        dispatch({
          type: 'SET_POSITION',
          payload: Math.min(state.position + 1, state.duration),
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state.isPlaying, state.position, state.duration]);

  // Auto-play next item when current item ends
  useEffect(() => {
    if (
      state.position >= state.duration &&
      state.duration > 0 &&
      state.isPlaying
    ) {
      if (state.repeatMode === 'one') {
        seekTo(0);
        play();
      } else {
        next();
      }
    }
  }, [state.position, state.duration, state.repeatMode, state.isPlaying]);

  const value: PlayerContextType = {
    ...state,
    play,
    pause,
    stop,
    next,
    previous,
    seekTo,
    setPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    setRepeatMode,
    toggleShuffle,
    setVolume,
    clearError,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};
