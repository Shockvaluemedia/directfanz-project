/**
 * Mini Player Component for Mobile App
 *
 * A compact, persistent audio player that appears at the bottom of screens:
 * - Always visible when audio is playing
 * - Shows current track info and basic controls
 * - Expandable to full player view
 * - Swipe gestures for track control
 * - Progress indicator
 * - Integration with global audio state
 * - Smooth animations and transitions
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { HapticFeedback, HapticFeedbackTypes } from 'react-native-haptic-feedback';

// Contexts and Services
import { useAudio } from '../../contexts/AudioContext';
import { formatDuration, shouldTriggerGesture } from '../../utils/playerUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MINI_PLAYER_HEIGHT = 60;

interface MiniPlayerProps {
  onPress?: () => void;
}

export function MiniPlayer({ onPress }: MiniPlayerProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, progress, duration, play, pause, skipToNext, skipToPrevious } =
    useAudio();

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderGrant: () => {
        // Scale down slightly when touch starts
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        // Update slide animation based on gesture
        slideAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Scale back to normal
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();

        const { dx, vx } = gestureState;

        if (shouldTriggerGesture(vx, dx, 300, 50)) {
          if (dx > 0) {
            // Swipe right - previous track
            handlePrevious();
            animateSwipe(SCREEN_WIDTH);
          } else {
            // Swipe left - next track
            handleNext();
            animateSwipe(-SCREEN_WIDTH);
          }
        } else {
          // Return to center
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 300,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animation functions
  const animateSwipe = (toValue: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
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

  // Control handlers
  const handlePlayPause = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.impactLight);
    pulseAnimation();

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handleNext = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.impactMedium);
    skipToNext();
  }, [skipToNext]);

  const handlePrevious = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.impactMedium);
    skipToPrevious();
  }, [skipToPrevious]);

  const handlePress = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.selection);

    if (onPress) {
      onPress();
    } else {
      // Navigate to full player
      navigation.navigate('Player' as never);
    }
  }, [onPress, navigation]);

  // Don't render if no current track
  if (!currentTrack) {
    return null;
  }

  const progressPercentage = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
      </View>

      {/* Background Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />

      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.content}>
          {/* Album Art */}
          <View style={styles.albumArtContainer}>
            <FastImage
              source={{
                uri: currentTrack.artwork || 'https://via.placeholder.com/60',
                priority: FastImage.priority.normal,
              }}
              style={styles.albumArt}
              resizeMode={FastImage.resizeMode.cover}
            />
          </View>

          {/* Track Info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Previous Button */}
            <TouchableOpacity
              onPress={handlePrevious}
              style={styles.controlButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name='play-skip-back' size={20} color='#fff' />
            </TouchableOpacity>

            {/* Play/Pause Button */}
            <TouchableOpacity
              onPress={handlePlayPause}
              style={[styles.controlButton, styles.playPauseButton]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={24} color='#fff' />
            </TouchableOpacity>

            {/* Next Button */}
            <TouchableOpacity
              onPress={handleNext}
              style={styles.controlButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name='play-skip-forward' size={20} color='#fff' />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Swipe Indicators */}
      <Animated.View
        style={[
          styles.swipeIndicator,
          styles.swipeLeft,
          {
            opacity: slideAnim.interpolate({
              inputRange: [-100, 0],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Icon name='play-skip-forward' size={16} color='#fff' />
        <Text style={styles.swipeText}>Next</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.swipeIndicator,
          styles.swipeRight,
          {
            opacity: slideAnim.interpolate({
              inputRange: [0, 100],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Text style={styles.swipeText}>Previous</Text>
        <Icon name='play-skip-back' size={16} color='#fff' />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MINI_PLAYER_HEIGHT,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  albumArtContainer: {
    width: 44,
    height: 44,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  trackInfo: {
    flex: 1,
    paddingRight: 8,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  playPauseButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    marginHorizontal: 8,
  },
  swipeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 185, 84, 0.9)',
    paddingHorizontal: 20,
  },
  swipeLeft: {
    left: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  swipeRight: {
    right: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  swipeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 4,
  },
});

export default MiniPlayer;
