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
} from 'react-native';
import Video, { VideoRef, OnLoadData, OnProgressData } from 'react-native-video';
import { useTheme } from '../../contexts/ThemeContext';
import {
  ContentItem,
  PlaybackState,
  PlaybackQuality,
  PlaybackSpeed,
} from '../../types/discovery';
import LoadingSpinner from '../common/LoadingSpinner';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoPlayerProps {
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

const VideoPlayer: React.FC<VideoPlayerProps> = ({
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
  const videoRef = useRef<VideoRef>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    video: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: '100%',
      height: '100%',
    },
    poster: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    posterImage: {
      width: '100%',
      height: '100%',
    },
    posterOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    playButtonIcon: {
      fontSize: 32,
      color: '#000',
      marginLeft: 4,
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    loadingText: {
      color: 'white',
      fontSize: 14,
      marginTop: 12,
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
      color: 'white',
      marginBottom: 16,
    },
    errorText: {
      color: 'white',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 8,
      fontWeight: '500',
    },
    errorSubtext: {
      color: 'rgba(255, 255, 255, 0.7)',
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
    bufferingIndicator: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -20 }, { translateY: -20 }],
    },
    qualityBadge: {
      position: 'absolute',
      top: 20,
      right: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    qualityText: {
      color: 'white',
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
  });

  // Get video URL based on quality
  const getVideoUrl = useCallback(() => {
    if (!content.mediaUrl) return '';
    
    // In a real app, you'd have different quality URLs
    switch (quality) {
      case '144p':
        return content.mediaUrl.replace('.mp4', '_144p.mp4');
      case '240p':
        return content.mediaUrl.replace('.mp4', '_240p.mp4');
      case '360p':
        return content.mediaUrl.replace('.mp4', '_360p.mp4');
      case '480p':
        return content.mediaUrl.replace('.mp4', '_480p.mp4');
      case '720p':
        return content.mediaUrl.replace('.mp4', '_720p.mp4');
      case '1080p':
        return content.mediaUrl.replace('.mp4', '_1080p.mp4');
      case '1440p':
        return content.mediaUrl.replace('.mp4', '_1440p.mp4');
      case '2160p':
        return content.mediaUrl.replace('.mp4', '_2160p.mp4');
      case 'auto':
      default:
        return content.mediaUrl;
    }
  }, [content.mediaUrl, quality]);

  // Handle video events
  const handleLoad = useCallback((data: OnLoadData) => {
    console.log('Video loaded:', data);
    setIsLoading(false);
    setHasError(false);
    onDurationChange(data.duration);
    onPlaybackStateChange('paused');
    
    // Fade in video
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [onDurationChange, onPlaybackStateChange, fadeAnim]);

  const handleProgress = useCallback((data: OnProgressData) => {
    onTimeUpdate(data.currentTime);
  }, [onTimeUpdate]);

  const handleBuffer = useCallback(({ isBuffering }: { isBuffering: boolean }) => {
    setBuffering(isBuffering);
    onBufferingChange(isBuffering);
  }, [onBufferingChange]);

  const handleError = useCallback((error: any) => {
    console.error('Video error:', error);
    setHasError(true);
    setIsLoading(false);
    onPlaybackStateChange('error');
  }, [onPlaybackStateChange]);

  const handlePlaybackStateChange = useCallback((data: { isPlaying: boolean }) => {
    if (data.isPlaying) {
      onPlaybackStateChange('playing');
      setShowPoster(false);
    } else {
      onPlaybackStateChange('paused');
    }
  }, [onPlaybackStateChange]);

  const handleEnd = useCallback(() => {
    onPlaybackStateChange('ended');
    setShowPoster(true);
  }, [onPlaybackStateChange]);

  const handlePlayPress = useCallback(() => {
    setShowPoster(false);
    onPlayPause();
  }, [onPlayPause]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setShowPoster(true);
    fadeAnim.setValue(0);
    
    // Force video reload by changing key
    if (videoRef.current) {
      videoRef.current.seek(0);
    }
  }, [fadeAnim]);

  // Seek to current time when it changes externally
  useEffect(() => {
    if (videoRef.current && Math.abs(currentTime - (videoRef.current as any).currentTime) > 1) {
      videoRef.current.seek(currentTime);
    }
  }, [currentTime]);

  // Format quality display text
  const getQualityDisplayText = useCallback(() => {
    if (quality === 'auto') return 'AUTO';
    return quality.toUpperCase();
  }, [quality]);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Failed to load video</Text>
        <Text style={styles.errorSubtext}>
          Please check your connection and try again
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <Animated.View
        style={[
          styles.video,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <Video
          ref={videoRef}
          source={{ uri: getVideoUrl() }}
          style={styles.video}
          paused={playbackState !== 'playing'}
          volume={volume}
          muted={isMuted}
          rate={speed}
          resizeMode={isFullscreen ? 'cover' : 'contain'}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onError={handleError}
          onPlaybackStateChanged={handlePlaybackStateChange}
          onEnd={handleEnd}
          progressUpdateInterval={1000}
          bufferConfig={{
            minBufferMs: 15000,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 5000,
          }}
        />
      </Animated.View>

      {/* Poster/Thumbnail */}
      {showPoster && content.thumbnailUrl && (
        <ImageBackground
          source={{ uri: content.thumbnailUrl }}
          style={styles.poster}
          imageStyle={styles.posterImage}
        >
          <View style={styles.posterOverlay}>
            <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
              <Text style={styles.playButtonIcon}>▶</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" color="white" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}

      {/* Buffering Indicator */}
      {buffering && !isLoading && (
        <View style={styles.bufferingIndicator}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      {/* Quality Badge */}
      {!showPoster && !isLoading && (
        <View style={styles.qualityBadge}>
          <Text style={styles.qualityText}>{getQualityDisplayText()}</Text>
        </View>
      )}

      {/* Live Indicator (if content is live) */}
      {content.isLive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveIcon} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
    </View>
  );
};

export default VideoPlayer;