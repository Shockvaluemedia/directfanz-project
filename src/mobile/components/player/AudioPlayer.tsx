/**
 * Mobile Audio Player Component
 *
 * This component provides a mobile-optimized audio player interface with:
 * - Native gesture controls (swipe, tap, long press)
 * - Lock screen integration with media controls
 * - Background playback with notification controls
 * - Mobile-friendly progress slider and controls
 * - Touch-optimized button sizes and spacing
 * - Responsive design for different screen sizes
 * - Integration with device audio session
 * - Haptic feedback for interactions
 * - Voice control integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  PanResponder,
  Animated,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  useTrackPlayerEvents,
  Event,
  State,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import { HapticFeedback, HapticFeedbackTypes } from 'react-native-haptic-feedback';

// Services
import audioService, { AudioTrack, PlaybackState } from '../../services/AudioService';
import notificationService from '../../services/NotificationService';

// Contexts
import { useAudio } from '../../contexts/AudioContext';

// Utils
import { formatDuration, getColors } from '../../utils/playerUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_HEIGHT = SCREEN_HEIGHT * 0.85;

interface AudioPlayerProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export function AudioPlayer({ isVisible = true, onClose }: AudioPlayerProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, queue } = useAudio();

  // Player state
  const [playerState, setPlayerState] = useState<PlaybackState>(audioService.getState());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPosition, setDraggedPosition] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [albumColors, setAlbumColors] = useState(['#1a1a1a', '#2a2a2a', '#3a3a3a']);

  // Progress tracking
  const playbackState = usePlaybackState();
  const progress = useProgress();

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pan responder for gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 20 || Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          // Vertical swipe - handle close gesture
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 150) {
          // Swipe down to close
          closePlayer();
        } else if (gestureState.dy < -50) {
          // Swipe up for queue
          setShowQueue(true);
        } else if (Math.abs(gestureState.dx) > 100) {
          // Horizontal swipe for track change
          handleSwipeTrackChange(gestureState.dx);
        } else {
          // Snap back to position
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Effects
  useEffect(() => {
    if (currentTrack?.artwork) {
      extractAlbumColors(currentTrack.artwork);
    }
  }, [currentTrack?.artwork]);

  useEffect(() => {
    // Listen to audio service events
    const handleStateChange = (newState: PlaybackState) => {
      setPlayerState(newState);
    };

    audioService.on('playbackStateChanged', handleStateChange);
    audioService.on('trackChanged', handleStateChange);

    return () => {
      audioService.off('playbackStateChanged', handleStateChange);
      audioService.off('trackChanged', handleStateChange);
    };
  }, []);

  useEffect(() => {
    // Animate album art rotation when playing
    if (isPlaying) {
      startRotationAnimation();
    } else {
      stopRotationAnimation();
    }
  }, [isPlaying]);

  // Animation functions
  const startRotationAnimation = () => {
    rotationAnim.setValue(0);
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 20000, // 20 seconds per rotation
        useNativeDriver: true,
      })
    ).start();
  };

  const stopRotationAnimation = () => {
    rotationAnim.stopAnimation();
  };

  const pulseAnimation = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Utility functions
  const extractAlbumColors = async (imageUrl: string) => {
    try {
      const colors = await getColors(imageUrl);
      setAlbumColors(colors);
    } catch (error) {
      console.error('Failed to extract colors:', error);
    }
  };

  const triggerHaptic = (type: HapticFeedbackTypes = HapticFeedbackTypes.impactLight) => {
    HapticFeedback.trigger(type);
  };

  // Control functions
  const togglePlayPause = useCallback(() => {
    triggerHaptic();
    pulseAnimation();

    if (isPlaying) {
      audioService.pause();
    } else {
      audioService.play();
    }
  }, [isPlaying]);

  const skipToNext = useCallback(() => {
    triggerHaptic();
    audioService.skipToNext();
  }, []);

  const skipToPrevious = useCallback(() => {
    triggerHaptic();
    audioService.skipToPrevious();
  }, []);

  const handleSeek = useCallback(
    (value: number) => {
      if (currentTrack) {
        const position = value * currentTrack.duration;
        setDraggedPosition(position);

        if (!isDragging) {
          audioService.seekTo(position);
        }
      }
    },
    [currentTrack, isDragging]
  );

  const handleSlidingStart = useCallback(() => {
    setIsDragging(true);
    triggerHaptic(HapticFeedbackTypes.selection);
  }, []);

  const handleSlidingComplete = useCallback(
    (value: number) => {
      if (currentTrack) {
        const position = value * currentTrack.duration;
        audioService.seekTo(position);
        setDraggedPosition(0);
        setIsDragging(false);
      }
    },
    [currentTrack]
  );

  const handleSwipeTrackChange = (dx: number) => {
    if (dx > 0) {
      skipToPrevious();
    } else {
      skipToNext();
    }
  };

  const closePlayer = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose?.();
      navigation.goBack();
    });
  };

  const toggleShuffle = () => {
    triggerHaptic();
    audioService.toggleShuffle();
  };

  const toggleRepeat = () => {
    triggerHaptic();
    audioService.setRepeatMode(
      playerState.repeatMode === 'off'
        ? 'track'
        : playerState.repeatMode === 'track'
          ? 'repeat'
          : 'off'
    );
  };

  const toggleLike = async () => {
    if (!currentTrack) return;

    triggerHaptic();

    try {
      // API call to toggle like status
      const response = await fetch(`/api/tracks/${currentTrack.id}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        // Update local state or refetch track data
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  // Get current position for display
  const getCurrentPosition = () => {
    if (isDragging) return draggedPosition;
    return progress.position || 0;
  };

  const getCurrentProgress = () => {
    if (!currentTrack) return 0;
    return getCurrentPosition() / currentTrack.duration;
  };

  if (!currentTrack || !isVisible) {
    return null;
  }

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor='transparent' translucent />

      {/* Background Gradient */}
      <LinearGradient colors={albumColors} style={StyleSheet.absoluteFillObject} />

      {/* Blur Overlay */}
      <BlurView style={StyleSheet.absoluteFillObject} blurType='dark' blurAmount={20} />

      <Animated.View
        style={[
          styles.playerContainer,
          {
            transform: [{ translateY: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={closePlayer}
            style={styles.closeButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Icon name='chevron-down' size={28} color='#fff' />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowQueue(true)}
            style={styles.queueButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Icon name='list' size={24} color='#fff' />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <View style={styles.albumArtContainer}>
          <Animated.View
            style={[
              styles.albumArtWrapper,
              {
                transform: [{ scale: scaleAnim }, { rotate: rotation }],
              },
            ]}
          >
            <TouchableWithoutFeedback onPress={togglePlayPause}>
              <FastImage
                source={{
                  uri: currentTrack.artwork || 'https://via.placeholder.com/300',
                  priority: FastImage.priority.high,
                }}
                style={styles.albumArt}
                resizeMode={FastImage.resizeMode.cover}
              />
            </TouchableWithoutFeedback>

            {/* Vinyl Record Effect */}
            <View style={styles.vinylHole} />
          </Animated.View>
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          {currentTrack.album && (
            <Text style={styles.trackAlbum} numberOfLines={1}>
              {currentTrack.album}
            </Text>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Slider
            style={styles.progressSlider}
            minimumValue={0}
            maximumValue={1}
            value={getCurrentProgress()}
            onValueChange={handleSeek}
            onSlidingStart={handleSlidingStart}
            onSlidingComplete={handleSlidingComplete}
            minimumTrackTintColor='#fff'
            maximumTrackTintColor='rgba(255, 255, 255, 0.3)'
            thumbStyle={styles.progressThumb}
            trackStyle={styles.progressTrack}
          />

          <View style={styles.timeLabels}>
            <Text style={styles.timeLabel}>{formatDuration(getCurrentPosition())}</Text>
            <Text style={styles.timeLabel}>{formatDuration(currentTrack.duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Secondary Controls */}
          <View style={styles.secondaryControls}>
            <TouchableOpacity
              onPress={toggleShuffle}
              style={[styles.controlButton, playerState.isShuffled && styles.activeControlButton]}
            >
              <Icon name='shuffle' size={20} color={playerState.isShuffled ? '#1DB954' : '#fff'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleLike} style={styles.controlButton}>
              <Icon
                name={currentTrack.isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={currentTrack.isLiked ? '#FF6B6B' : '#fff'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleRepeat}
              style={[
                styles.controlButton,
                playerState.repeatMode !== 'off' && styles.activeControlButton,
              ]}
            >
              <Icon
                name={playerState.repeatMode === 'track' ? 'repeat' : 'repeat'}
                size={20}
                color={playerState.repeatMode !== 'off' ? '#1DB954' : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Main Controls */}
          <View style={styles.mainControls}>
            <TouchableOpacity onPress={skipToPrevious} style={styles.skipButton}>
              <Icon name='play-skip-back' size={32} color='#fff' />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseButton}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={40} color='#000' />
            </TouchableOpacity>

            <TouchableOpacity onPress={skipToNext} style={styles.skipButton}>
              <Icon name='play-skip-forward' size={32} color='#fff' />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.controlButton}>
              <Icon name='share-outline' size={20} color='#fff' />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton}>
              <Icon name='download-outline' size={20} color='#fff' />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  queueButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  albumArtWrapper: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: (SCREEN_WIDTH * 0.75) / 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    position: 'relative',
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  vinylHole: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
    marginTop: -10,
    marginLeft: -10,
  },
  trackInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  trackArtist: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  trackAlbum: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  progressSlider: {
    width: '100%',
    height: 40,
  },
  progressThumb: {
    width: 15,
    height: 15,
    backgroundColor: '#fff',
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  controls: {
    paddingBottom: 20,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  activeControlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
