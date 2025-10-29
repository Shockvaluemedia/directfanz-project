import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  PanGestureHandler,
  State as GestureState,
  Animated,
  BackHandler,
  Alert,
  Share,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentItem,
  PlaybackState,
  PlaybackQuality,
  PlaybackSpeed,
} from '../../types/discovery';
import VideoPlayer from '../../components/player/VideoPlayer';
import AudioPlayer from '../../components/player/AudioPlayer';
import PlayerControls from '../../components/player/PlayerControls';
import PlaybackSettings from '../../components/player/PlaybackSettings';
import ContentInfo from '../../components/player/ContentInfo';
import RelatedContent from '../../components/player/RelatedContent';
import Comments from '../../components/player/Comments';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ContentPlayerScreenProps {
  route: RouteProp<{ params: { contentId: string; content?: ContentItem } }>;
}

const ContentPlayerScreen: React.FC<ContentPlayerScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { contentId, content: initialContent } = route.params as { contentId: string; content?: ContentItem };
  
  const {
    getContentById,
    getRelatedContent,
    toggleLike,
    toggleBookmark,
    trackView,
    reportPlaybackProgress,
  } = useDiscovery();

  const [content, setContent] = useState<ContentItem | null>(initialContent || null);
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(!initialContent);
  const [error, setError] = useState<string | null>(null);
  
  // Player State
  const [playbackState, setPlaybackState] = useState<PlaybackState>('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [quality, setQuality] = useState<PlaybackQuality>('auto');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  
  // UI State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'comments' | 'related'>('info');
  
  // Gesture Handling
  const panY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastProgressReport = useRef(0);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    playerContainer: {
      flex: 1,
      position: 'relative',
    },
    
    // Loading and Error States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
      padding: 20,
    },
    errorText: {
      fontSize: 16,
      color: 'white',
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.medium,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    
    // Player Header
    playerHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: 16,
      zIndex: 1000,
      background: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      marginHorizontal: 16,
    },
    
    // Content Info Overlay (for fullscreen)
    contentOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
      zIndex: 100,
    },
    overlayTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 4,
    },
    overlayCreator: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 8,
    },
    overlayActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    overlayAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    overlayActionIcon: {
      fontSize: 16,
      color: 'white',
    },
    overlayActionText: {
      fontSize: 12,
      color: 'white',
      fontWeight: '600',
    },
    
    // Bottom Content Panel
    bottomPanel: {
      backgroundColor: theme.colors.background,
      maxHeight: screenHeight * 0.6,
    },
    panelHandle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginVertical: 12,
    },
    panelTabs: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 20,
    },
    panelTab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    panelTabActive: {
      borderBottomColor: theme.colors.primary,
    },
    panelTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    panelTabTextActive: {
      color: theme.colors.primary,
    },
    panelContent: {
      flex: 1,
      paddingHorizontal: 20,
    },
    
    // Picture-in-Picture Mode
    pipContainer: {
      position: 'absolute',
      top: 100,
      right: 20,
      width: 160,
      height: 90,
      borderRadius: theme.borderRadius.medium,
      overflow: 'hidden',
      backgroundColor: '#000',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      zIndex: 2000,
    },
    pipPlayer: {
      flex: 1,
    },
    pipControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingVertical: 4,
    },
    pipButton: {
      padding: 4,
      marginHorizontal: 4,
    },
    
    // Gesture Overlay
    gestureOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
    },
  });

  // Load content and related content
  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);

        let contentData = initialContent;
        if (!contentData) {
          contentData = await getContentById(contentId);
          if (!contentData) {
            throw new Error('Content not found');
          }
          setContent(contentData);
        }

        // Track view
        await trackView(contentId);

        // Load related content
        const related = await getRelatedContent(contentId, { limit: 10 });
        setRelatedContent(related);

      } catch (err) {
        console.error('Failed to load content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [contentId, initialContent, getContentById, trackView, getRelatedContent]);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isFullscreen) {
          setIsFullscreen(false);
          return true;
        }
        if (showSettings) {
          setShowSettings(false);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isFullscreen, showSettings])
  );

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    setShowControls(true);
    
    if (playbackState === 'playing') {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playbackState]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [resetControlsTimer]);

  // Progress reporting
  useEffect(() => {
    if (duration > 0 && currentTime > 0) {
      const progress = (currentTime / duration) * 100;
      
      // Report progress every 10 seconds or at major milestones
      if (
        currentTime - lastProgressReport.current >= 10 ||
        progress >= 25 && lastProgressReport.current < duration * 0.25 ||
        progress >= 50 && lastProgressReport.current < duration * 0.50 ||
        progress >= 75 && lastProgressReport.current < duration * 0.75 ||
        progress >= 95 && lastProgressReport.current < duration * 0.95
      ) {
        reportPlaybackProgress(contentId, currentTime, duration);
        lastProgressReport.current = currentTime;
      }
    }
  }, [currentTime, duration, contentId, reportPlaybackProgress]);

  // Player event handlers
  const handlePlayPause = useCallback(() => {
    setPlaybackState(prev => prev === 'playing' ? 'paused' : 'playing');
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleQualityChange = useCallback((newQuality: PlaybackQuality) => {
    setQuality(newQuality);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: PlaybackSpeed) => {
    setSpeed(newSpeed);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1.0);
      }
      return newMuted;
    });
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(prev => !prev);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleLike = useCallback(async () => {
    if (!content) return;
    
    try {
      await toggleLike(content.id);
      setContent(prev => prev ? {
        ...prev,
        isLiked: !prev.isLiked,
        likesCount: prev.isLiked ? prev.likesCount - 1 : prev.likesCount + 1,
      } : null);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }, [content, toggleLike]);

  const handleBookmark = useCallback(async () => {
    if (!content) return;
    
    try {
      await toggleBookmark(content.id);
      setContent(prev => prev ? {
        ...prev,
        isBookmarked: !prev.isBookmarked,
      } : null);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  }, [content, toggleBookmark]);

  const handleShare = useCallback(async () => {
    if (!content) return;
    
    try {
      await Share.share({
        message: `Check out "${content.title}" by ${content.creator.name} on Nahvee Even!`,
        url: `https://nahveeeven.com/content/${content.id}`,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [content]);

  const handleRelatedContentPress = useCallback((relatedContent: ContentItem) => {
    // Replace current content
    setContent(relatedContent);
    setCurrentTime(0);
    setPlaybackState('loading');
    
    // Update URL params would go here in a real app
    navigation.setParams({ contentId: relatedContent.id, content: relatedContent } as never);
  }, [navigation]);

  // Pan gesture handler for dismissing player
  const handlePanGesture = useCallback((event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    if (state === GestureState.ACTIVE) {
      if (translationY > 0) {
        panY.setValue(translationY);
        opacity.setValue(1 - translationY / 300);
      }
    } else if (state === GestureState.END) {
      if (translationY > 100 || velocityY > 1000) {
        // Dismiss player
        Animated.parallel([
          Animated.timing(panY, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          navigation.goBack();
        });
      } else {
        // Snap back
        Animated.parallel([
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [panY, opacity, navigation]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const formatNumber = useCallback((num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden />
        <LoadingSpinner size="large" />
        <Text style={{ color: 'white', fontSize: 16, marginTop: 16 }}>
          Loading content...
        </Text>
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar hidden />
        <Text style={styles.errorText}>
          {error || 'Content not found'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            // Retry logic would go here
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const PlayerComponent = content.type === 'AUDIO' ? AudioPlayer : VideoPlayer;

  return (
    <PanGestureHandler
      onGestureEvent={handlePanGesture}
      onHandlerStateChange={handlePanGesture}
      enabled={!isFullscreen}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: panY }],
            opacity: opacity,
          }
        ]}
      >
        <StatusBar hidden={isFullscreen} />
        
        <View style={styles.playerContainer}>
          {/* Player Header */}
          {showControls && (
            <Animated.View style={styles.playerHeader}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={{ fontSize: 18, color: 'white' }}>←</Text>
              </TouchableOpacity>
              
              <Text style={styles.headerTitle} numberOfLines={1}>
                {content.title}
              </Text>
              
              <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
                <Text style={{ fontSize: 16, color: 'white' }}>↗</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Main Player */}
          <PlayerComponent
            content={content}
            playbackState={playbackState}
            currentTime={currentTime}
            duration={duration}
            quality={quality}
            speed={speed}
            volume={volume}
            isMuted={isMuted}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onBufferingChange={setBuffering}
            onPlaybackStateChange={setPlaybackState}
            isFullscreen={isFullscreen}
          />

          {/* Player Controls Overlay */}
          <PlayerControls
            visible={showControls}
            playbackState={playbackState}
            currentTime={currentTime}
            duration={duration}
            buffering={buffering}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onFullscreenToggle={handleFullscreenToggle}
            onSettingsPress={() => setShowSettings(true)}
            onControlsPress={resetControlsTimer}
          />

          {/* Content Overlay for Fullscreen */}
          {isFullscreen && showControls && (
            <View style={styles.contentOverlay}>
              <Text style={styles.overlayTitle} numberOfLines={2}>
                {content.title}
              </Text>
              <Text style={styles.overlayCreator}>
                by {content.creator.name}
              </Text>
              <View style={styles.overlayActions}>
                <TouchableOpacity style={styles.overlayAction} onPress={handleLike}>
                  <Text style={styles.overlayActionIcon}>
                    {content.isLiked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={styles.overlayActionText}>
                    {formatNumber(content.likesCount)}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.overlayAction} onPress={handleBookmark}>
                  <Text style={styles.overlayActionIcon}>
                    {content.isBookmarked ? '🔖' : '🏷️'}
                  </Text>
                  <Text style={styles.overlayActionText}>Save</Text>
                </TouchableOpacity>
                
                <View style={styles.overlayAction}>
                  <Text style={styles.overlayActionIcon}>👁</Text>
                  <Text style={styles.overlayActionText}>
                    {formatNumber(content.viewsCount)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Gesture Overlay */}
          <TouchableOpacity
            style={styles.gestureOverlay}
            activeOpacity={1}
            onPress={resetControlsTimer}
          />
        </View>

        {/* Bottom Content Panel */}
        {!isFullscreen && (
          <View style={styles.bottomPanel}>
            <View style={styles.panelHandle} />
            
            {/* Tabs */}
            <View style={styles.panelTabs}>
              {(['info', 'comments', 'related'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.panelTab, activeTab === tab && styles.panelTabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[
                    styles.panelTabText,
                    activeTab === tab && styles.panelTabTextActive,
                  ]}>
                    {tab === 'info' ? 'Info' :
                     tab === 'comments' ? 'Comments' : 'Related'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab Content */}
            <ScrollView style={styles.panelContent} showsVerticalScrollIndicator={false}>
              {activeTab === 'info' && (
                <ContentInfo
                  content={content}
                  onLike={handleLike}
                  onBookmark={handleBookmark}
                  onShare={handleShare}
                  onCreatorPress={(creatorId) => {
                    navigation.navigate('CreatorProfile' as never, { creatorId } as never);
                  }}
                />
              )}
              
              {activeTab === 'comments' && (
                <Comments
                  contentId={content.id}
                  onCommentPress={() => {}}
                />
              )}
              
              {activeTab === 'related' && (
                <RelatedContent
                  content={relatedContent}
                  onContentPress={handleRelatedContentPress}
                  onCreatorPress={(creatorId) => {
                    navigation.navigate('CreatorProfile' as never, { creatorId } as never);
                  }}
                />
              )}
            </ScrollView>
          </View>
        )}

        {/* Settings Modal */}
        <PlaybackSettings
          visible={showSettings}
          quality={quality}
          speed={speed}
          onQualityChange={handleQualityChange}
          onSpeedChange={handleSpeedChange}
          onClose={() => setShowSettings(false)}
        />
      </Animated.View>
    </PanGestureHandler>
  );
};

export default ContentPlayerScreen;