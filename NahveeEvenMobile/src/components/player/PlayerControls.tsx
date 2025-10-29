import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  PanGestureHandler,
  State as GestureState,
} from 'react-native-gesture-handler';
import { useTheme } from '../../hooks/useTheme';
import { PlaybackState } from '../../types/discovery';

const { width: screenWidth } = Dimensions.get('window');

interface PlayerControlsProps {
  visible: boolean;
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  buffering: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onSettingsPress: () => void;
  onControlsPress: () => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  visible,
  playbackState,
  currentTime,
  duration,
  buffering,
  volume,
  isMuted,
  isFullscreen,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  onSettingsPress,
  onControlsPress,
}) => {
  const { theme } = useTheme();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const volumeSliderAnim = useRef(new Animated.Value(0)).current;
  const seekGestureState = useRef({ seeking: false, seekTime: 0 }).current;

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
      pointerEvents: visible ? 'auto' : 'none',
    },
    gradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    topGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      background: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
    },
    bottomGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 120,
      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    },
    
    // Center Play/Pause Button
    centerControls: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -40 }, { translateY: -40 }],
      alignItems: 'center',
      justifyContent: 'center',
    },
    playPauseButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    playPauseIcon: {
      fontSize: 32,
      color: '#000',
      marginLeft: playbackState === 'playing' ? 0 : 4,
    },
    bufferingContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Bottom Controls
    bottomControls: {
      position: 'absolute',
      bottom: isFullscreen ? 20 : 40,
      left: 20,
      right: 20,
    },
    timelineContainer: {
      marginBottom: 16,
    },
    timeline: {
      height: 40,
      justifyContent: 'center',
    },
    timelineTrack: {
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 2,
      position: 'relative',
    },
    timelineProgress: {
      height: 4,
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    timelineBuffer: {
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      borderRadius: 2,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    timelineThumb: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
      position: 'absolute',
      top: -6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    timeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    timeLabel: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
    },
    
    // Control Buttons
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlButtonIcon: {
      fontSize: 18,
      color: 'white',
    },
    controlButtonText: {
      fontSize: 14,
      color: 'white',
      fontWeight: '600',
    },
    
    // Volume Controls
    volumeContainer: {
      position: 'absolute',
      bottom: 120,
      left: 20,
      alignItems: 'center',
    },
    volumeSlider: {
      width: 200,
      height: 40,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    volumeTrack: {
      flex: 1,
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 2,
      marginHorizontal: 12,
      position: 'relative',
    },
    volumeProgress: {
      height: 4,
      backgroundColor: 'white',
      borderRadius: 2,
      position: 'absolute',
      left: 0,
      top: 0,
    },
    volumeThumb: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: 'white',
      position: 'absolute',
      top: -4,
    },
    volumeIcon: {
      fontSize: 16,
      color: 'white',
    },
    
    // Skip Buttons (for fullscreen)
    skipButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipButtonIcon: {
      fontSize: 24,
      color: 'white',
    },
    skipButtonText: {
      fontSize: 10,
      color: 'white',
      marginTop: 2,
    },
    
    // Gesture overlay for seeking
    seekOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    seekIndicator: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
      flexDirection: 'row',
      alignItems: 'center',
    },
    seekIndicatorIcon: {
      fontSize: 20,
      color: 'white',
      marginRight: 8,
    },
    seekIndicatorText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  // Animate visibility
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Animate volume slider
  React.useEffect(() => {
    Animated.timing(volumeSliderAnim, {
      toValue: showVolumeSlider ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showVolumeSlider, volumeSliderAnim]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const handleTimelinePress = useCallback((event: any) => {
    const { locationX } = event.nativeEvent;
    const trackWidth = screenWidth - 40; // Account for padding
    const progress = locationX / trackWidth;
    const seekTime = progress * duration;
    onSeek(Math.max(0, Math.min(seekTime, duration)));
  }, [duration, onSeek]);

  const handleVolumePress = useCallback((event: any) => {
    const { locationX } = event.nativeEvent;
    const trackWidth = 168; // Volume track width (200 - 32 padding)
    const progress = Math.max(0, Math.min(locationX / trackWidth, 1));
    onVolumeChange(progress);
  }, [onVolumeChange]);

  const handleVolumeButtonPress = useCallback(() => {
    setShowVolumeSlider(prev => !prev);
  }, []);

  const handleSkipBackward = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10);
    onSeek(newTime);
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(duration, currentTime + 10);
    onSeek(newTime);
  }, [currentTime, duration, onSeek]);

  // Handle seeking gestures
  const handleSeekGesture = useCallback((event: any) => {
    const { translationX, state } = event.nativeEvent;
    
    if (state === GestureState.ACTIVE) {
      if (!seekGestureState.seeking) {
        seekGestureState.seeking = true;
        seekGestureState.seekTime = currentTime;
      }
      
      // Calculate seek time based on gesture
      const seekDelta = (translationX / screenWidth) * 60; // 1 screen width = 60 seconds
      const newSeekTime = Math.max(0, Math.min(duration, seekGestureState.seekTime + seekDelta));
      
      // Visual feedback would go here
      
    } else if (state === GestureState.END) {
      if (seekGestureState.seeking) {
        const seekDelta = (translationX / screenWidth) * 60;
        const newSeekTime = Math.max(0, Math.min(duration, seekGestureState.seekTime + seekDelta));
        onSeek(newSeekTime);
        
        seekGestureState.seeking = false;
      }
    }
  }, [currentTime, duration, onSeek, seekGestureState]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercentage = 0; // Would be calculated from actual buffer data
  const volumePercentage = volume * 100;

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Background Gradients */}
      <View style={styles.topGradient} />
      <View style={styles.bottomGradient} />

      {/* Center Play/Pause Controls */}
      {!isFullscreen && (
        <View style={styles.centerControls}>
          {buffering ? (
            <View style={styles.bufferingContainer}>
              <ActivityIndicator size="large" color="#000" />
            </View>
          ) : (
            <TouchableOpacity style={styles.playPauseButton} onPress={onPlayPause}>
              <Text style={styles.playPauseIcon}>
                {playbackState === 'playing' ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Seek Gesture Overlay */}
      <PanGestureHandler
        onGestureEvent={handleSeekGesture}
        onHandlerStateChange={handleSeekGesture}
        minDeltaX={10}
      >
        <View style={styles.seekOverlay}>
          {seekGestureState.seeking && (
            <View style={styles.seekIndicator}>
              <Text style={styles.seekIndicatorIcon}>⏩</Text>
              <Text style={styles.seekIndicatorText}>
                {formatTime(seekGestureState.seekTime)}
              </Text>
            </View>
          )}
        </View>
      </PanGestureHandler>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Timeline */}
        <View style={styles.timelineContainer}>
          <TouchableOpacity style={styles.timeline} onPress={handleTimelinePress}>
            <View style={styles.timelineTrack}>
              {/* Buffer Progress */}
              <View
                style={[
                  styles.timelineBuffer,
                  { width: `${bufferPercentage}%` }
                ]}
              />
              
              {/* Playback Progress */}
              <View
                style={[
                  styles.timelineProgress,
                  { width: `${progressPercentage}%` }
                ]}
              />
              
              {/* Progress Thumb */}
              <View
                style={[
                  styles.timelineThumb,
                  { left: `${progressPercentage}%`, marginLeft: -8 }
                ]}
              />
            </View>
          </TouchableOpacity>
          
          {/* Time Labels */}
          <View style={styles.timeLabels}>
            <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsRow}>
          {isFullscreen ? (
            <>
              {/* Skip Backward */}
              <TouchableOpacity style={styles.skipButton} onPress={handleSkipBackward}>
                <Text style={styles.skipButtonIcon}>⏪</Text>
                <Text style={styles.skipButtonText}>10s</Text>
              </TouchableOpacity>
              
              {/* Play/Pause */}
              <TouchableOpacity style={styles.playPauseButton} onPress={onPlayPause}>
                <Text style={styles.playPauseIcon}>
                  {playbackState === 'playing' ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
              
              {/* Skip Forward */}
              <TouchableOpacity style={styles.skipButton} onPress={handleSkipForward}>
                <Text style={styles.skipButtonIcon}>⏩</Text>
                <Text style={styles.skipButtonText}>10s</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Volume */}
              <TouchableOpacity style={styles.controlButton} onPress={handleVolumeButtonPress}>
                <Text style={styles.controlButtonIcon}>
                  {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
                </Text>
              </TouchableOpacity>
              
              {/* Skip Backward */}
              <TouchableOpacity style={styles.controlButton} onPress={handleSkipBackward}>
                <Text style={styles.controlButtonIcon}>⏪</Text>
              </TouchableOpacity>
              
              {/* Play/Pause */}
              <TouchableOpacity style={styles.playPauseButton} onPress={onPlayPause}>
                <Text style={styles.playPauseIcon}>
                  {playbackState === 'playing' ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
              
              {/* Skip Forward */}
              <TouchableOpacity style={styles.controlButton} onPress={handleSkipForward}>
                <Text style={styles.controlButtonIcon}>⏩</Text>
              </TouchableOpacity>
              
              {/* Settings */}
              <TouchableOpacity style={styles.controlButton} onPress={onSettingsPress}>
                <Text style={styles.controlButtonIcon}>⚙️</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Fullscreen Toggle */}
          <TouchableOpacity style={styles.controlButton} onPress={onFullscreenToggle}>
            <Text style={styles.controlButtonIcon}>
              {isFullscreen ? '⤓' : '⤢'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Volume Slider */}
      <Animated.View
        style={[
          styles.volumeContainer,
          {
            opacity: volumeSliderAnim,
            transform: [{ translateY: volumeSliderAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            })}],
          }
        ]}
        pointerEvents={showVolumeSlider ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.volumeSlider} onPress={handleVolumePress}>
          <TouchableOpacity onPress={onMuteToggle}>
            <Text style={styles.volumeIcon}>
              {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.volumeTrack}>
            <View
              style={[
                styles.volumeProgress,
                { width: `${isMuted ? 0 : volumePercentage}%` }
              ]}
            />
            <View
              style={[
                styles.volumeThumb,
                { 
                  left: `${isMuted ? 0 : volumePercentage}%`,
                  marginLeft: -6
                }
              ]}
            />
          </View>
          
          <Text style={[styles.volumeIcon, { fontSize: 12 }]}>
            {Math.round(isMuted ? 0 : volumePercentage)}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Touch overlay to handle control visibility */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        activeOpacity={1}
        onPress={onControlsPress}
      />
    </Animated.View>
  );
};

export default PlayerControls;