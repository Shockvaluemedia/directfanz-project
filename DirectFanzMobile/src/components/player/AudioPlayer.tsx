import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ImageBackground,
  TouchableOpacity,
  Text,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import Sound from 'react-native-sound';
import { useTheme } from '../../contexts/ThemeContext';
import {
  ContentItem,
  PlaybackState,
  PlaybackQuality,
  PlaybackSpeed,
} from '../../types/discovery';
import LoadingSpinner from '../common/LoadingSpinner';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AudioPlayerProps {
  content: ContentItem;
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  quality: PlaybackQuality;
  speed: PlaybackSpeed;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onBufferingChange: (buffering: boolean) => void;
  onPlaybackStateChange: (state: PlaybackState) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  content,
  playbackState,
  currentTime,
  duration,
  quality,
  speed,
  volume,
  isMuted,
  isFullscreen,
  onPlayPause,
  onSeek,
  onTimeUpdate,
  onDurationChange,
  onBufferingChange,
  onPlaybackStateChange,
}) => {
  const { theme } = useTheme();
  const soundRef = useRef<Sound | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.3,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    
    // Album Art / Cover Image
    albumArtContainer: {
      width: isFullscreen ? 280 : 200,
      height: isFullscreen ? 280 : 200,
      marginBottom: 40,
      position: 'relative',
    },
    albumArt: {
      width: '100%',
      height: '100%',
      borderRadius: isFullscreen ? 140 : 100,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    },
    albumArtImage: {
      width: '100%',
      height: '100%',
      borderRadius: isFullscreen ? 140 : 100,
    },
    albumArtPlaceholder: {
      width: '60%',
      height: '60%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    albumArtPlaceholderText: {
      fontSize: 48,
      color: theme.colors.textSecondary,
    },
    playButton: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    playButtonIcon: {
      fontSize: 28,
      color: 'white',
      marginLeft: 3,
    },
    pauseButtonIcon: {
      fontSize: 28,
      color: 'white',
    },
    
    // Track Info
    trackInfo: {
      alignItems: 'center',
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    trackTitle: {
      fontSize: isFullscreen ? 24 : 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    trackArtist: {
      fontSize: isFullscreen ? 16 : 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    trackAlbum: {
      fontSize: isFullscreen ? 14 : 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    
    // Waveform Visualization
    waveformContainer: {
      width: '100%',
      height: 80,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    waveformBar: {
      width: 3,
      backgroundColor: theme.colors.textSecondary,
      marginHorizontal: 1,
      borderRadius: 1.5,
      opacity: 0.4,
    },
    waveformBarActive: {
      backgroundColor: theme.colors.primary,
      opacity: 1,
    },
    waveformBarPlayed: {
      backgroundColor: theme.colors.primary,
      opacity: 0.8,
    },
    
    // Progress Indicator (for non-waveform)
    progressContainer: {
      width: '100%',
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    progressRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: theme.colors.border,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressRingActive: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: theme.colors.primary,
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
    },
    progressText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    
    // Loading and Error States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 16,
      marginTop: 16,
      fontWeight: '500',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorIcon: {
      fontSize: 48,
      color: theme.colors.error,
      marginBottom: 16,
    },
    errorText: {
      color: theme.colors.text,
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 8,
      fontWeight: '500',
    },
    errorSubtext: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // Quality and Status Indicators
    qualityBadge: {
      position: 'absolute',
      top: 20,
      right: 20,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    qualityText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    liveIndicator: {
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: theme.colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      flexDirection: 'row',
      alignItems: 'center',
    },
    liveIcon: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'white',
      marginRight: 4,
    },
    liveText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '700',
    },
    bufferingIndicator: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -20 }, { translateY: -20 }],
    },
    
    // Animated Elements
    pulseContainer: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: isFullscreen ? 140 : 100,
      backgroundColor: theme.colors.primary,
      opacity: 0.2,
    },
  });

  // Generate waveform data (mock implementation)
  const generateWaveformData = useCallback(() => {
    const dataPoints = Math.floor(screenWidth / 5); // ~80-100 bars
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      data.push(Math.random() * 60 + 10); // Heights between 10-70
    }
    setWaveformData(data);
  }, []);

  // Get audio URL based on quality
  const getAudioUrl = useCallback(() => {
    if (!content.mediaUrl) return '';
    
    // In a real app, you'd have different quality URLs
    switch (quality) {
      case '64kbps':
        return content.mediaUrl.replace('.mp3', '_64k.mp3');
      case '128kbps':
        return content.mediaUrl.replace('.mp3', '_128k.mp3');
      case '256kbps':
        return content.mediaUrl.replace('.mp3', '_256k.mp3');
      case '320kbps':
        return content.mediaUrl.replace('.mp3', '_320k.mp3');
      case 'lossless':
        return content.mediaUrl.replace('.mp3', '.flac');
      case 'auto':
      default:
        return content.mediaUrl;
    }
  }, [content.mediaUrl, quality]);

  // Initialize audio
  useEffect(() => {
    const initializeAudio = () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        // Create new Sound instance
        const sound = new Sound(getAudioUrl(), Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.error('Failed to load audio:', error);
            setHasError(true);
            setIsLoading(false);
            onPlaybackStateChange('error');
            return;
          }
          
          // Audio loaded successfully
          setIsLoading(false);
          onDurationChange(sound.getDuration());
          onPlaybackStateChange('paused');
          
          // Generate waveform data
          generateWaveformData();
        });
        
        soundRef.current = sound;
        
        // Set initial properties
        sound.setVolume(volume);
        sound.setSpeed(speed);
        
      } catch (error) {
        console.error('Audio initialization error:', error);
        setHasError(true);
        setIsLoading(false);
        onPlaybackStateChange('error');
      }
    };
    
    initializeAudio();
    
    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.release();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [getAudioUrl, volume, speed, onDurationChange, onPlaybackStateChange, generateWaveformData]);

  // Handle playback state changes
  useEffect(() => {
    if (!soundRef.current) return;
    
    if (playbackState === 'playing') {
      soundRef.current.play((success) => {
        if (success) {
          onPlaybackStateChange('ended');
        }
      });
      
      // Start progress tracking
      progressInterval.current = setInterval(() => {
        if (soundRef.current) {
          soundRef.current.getCurrentTime((seconds) => {
            onTimeUpdate(seconds);
          });
        }
      }, 1000);
      
      // Start rotation animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
      
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
    } else {
      soundRef.current.pause();
      
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      
      // Stop animations
      rotateAnim.stopAnimation();
      pulseAnim.stopAnimation();
    }
  }, [playbackState, rotateAnim, pulseAnim, onTimeUpdate, onPlaybackStateChange]);

  // Handle volume changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Handle speed changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setSpeed(speed);
    }
  }, [speed]);

  // Handle seek
  useEffect(() => {
    if (soundRef.current && Math.abs(currentTime - 0) > 1) {
      soundRef.current.setCurrentTime(currentTime);
    }
  }, [currentTime]);

  const handlePlayPress = useCallback(() => {
    onPlayPause();
  }, [onPlayPause]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.release();
    }
    
    // Re-initialize will happen via useEffect
  }, []);

  const handleWaveformPress = useCallback((index: number) => {
    if (waveformData.length === 0 || duration === 0) return;
    
    const progress = index / waveformData.length;
    const seekTime = progress * duration;
    onSeek(seekTime);
  }, [waveformData.length, duration, onSeek]);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const getQualityDisplayText = useCallback(() => {
    if (quality === 'auto') return 'AUTO';
    return quality.toUpperCase();
  }, [quality]);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🎵</Text>
        <Text style={styles.errorText}>Failed to load audio</Text>
        <Text style={styles.errorSubtext}>
          Please check your connection and try again
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Loading audio...</Text>
      </View>
    );
  }

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      {content.thumbnailUrl && (
        <ImageBackground
          source={{ uri: content.thumbnailUrl }}
          style={styles.backgroundGradient}
          blurRadius={50}
        />
      )}

      {/* Quality Badge */}
      <View style={styles.qualityBadge}>
        <Text style={styles.qualityText}>{getQualityDisplayText()}</Text>
      </View>

      {/* Live Indicator */}
      {content.isLive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveIcon} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      <View style={styles.contentContainer}>
        {/* Album Art */}
        <View style={styles.albumArtContainer}>
          {playbackState === 'playing' && (
            <Animated.View
              style={[
                styles.pulseContainer,
                {
                  transform: [{ scale: pulseAnim }],
                }
              ]}
            />
          )}
          
          <Animated.View
            style={[
              styles.albumArt,
              {
                transform: [
                  { rotate: playbackState === 'playing' ? rotation : '0deg' },
                  { scale: scaleAnim },
                ],
              }
            ]}
          >
            {content.thumbnailUrl ? (
              <Image
                source={{ uri: content.thumbnailUrl }}
                style={styles.albumArtImage}
              />
            ) : (
              <View style={styles.albumArtPlaceholder}>
                <Text style={styles.albumArtPlaceholderText}>🎵</Text>
              </View>
            )}
          </Animated.View>
          
          {/* Play/Pause Button */}
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
            <Text style={playbackState === 'playing' ? styles.pauseButtonIcon : styles.playButtonIcon}>
              {playbackState === 'playing' ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {content.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {content.creator.name}
          </Text>
          {content.metadata?.album && (
            <Text style={styles.trackAlbum} numberOfLines={1}>
              {content.metadata.album}
            </Text>
          )}
        </View>

        {/* Waveform Visualization */}
        {waveformData.length > 0 ? (
          <View style={styles.waveformContainer}>
            {waveformData.map((height, index) => {
              const progress = duration > 0 ? currentTime / duration : 0;
              const isPlayed = index < progress * waveformData.length;
              const isActive = Math.abs(index - progress * waveformData.length) < 2;
              
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleWaveformPress(index)}
                  style={[
                    styles.waveformBar,
                    { height: height },
                    isActive && styles.waveformBarActive,
                    isPlayed && styles.waveformBarPlayed,
                  ]}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.progressContainer}>
            <View style={styles.progressRing}>
              <Animated.View
                style={[
                  styles.progressRingActive,
                  {
                    transform: [
                      { rotate: `${(currentTime / duration) * 360 || 0}deg` }
                    ],
                  }
                ]}
              />
              <Text style={styles.progressText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Buffering Indicator */}
      {buffering && (
        <View style={styles.bufferingIndicator}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
};

export default AudioPlayer;