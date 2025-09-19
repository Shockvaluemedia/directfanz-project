/**
 * Mobile Home Screen
 *
 * Main screen for the React Native mobile app featuring:
 * - Hero section with featured content
 * - Recently played tracks
 * - Trending content sections
 * - Quick access to playlists and favorites
 * - Search integration
 * - Offline content indicators
 * - Mini player integration
 * - Native navigation and gestures
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { HapticFeedback, HapticFeedbackTypes } from 'react-native-haptic-feedback';

// Components
import MiniPlayer from '../components/player/MiniPlayer';

// Contexts and Services
import { useAudio } from '../contexts/AudioContext';
import audioService, { AudioTrack } from '../services/AudioService';
import notificationService from '../services/NotificationService';

// Utils
import { formatDuration, getPlaceholderColors } from '../utils/playerUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ContentSection {
  id: string;
  title: string;
  items: AudioTrack[];
  type: 'horizontal' | 'grid' | 'featured';
}

export function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, playTrack, isOfflineMode, downloadedTracks } = useAudio();

  // State
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredTrack, setFeaturedTrack] = useState<AudioTrack | null>(null);
  const [greetingMessage, setGreetingMessage] = useState('');

  // Effects
  useEffect(() => {
    initializeScreen();
    setGreetingMessage(getGreetingMessage());

    // Request notification permissions on first launch
    notificationService.requestPermissions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Refresh content when screen is focused
      loadContent();
    }, [isOfflineMode])
  );

  // Functions
  const getGreetingMessage = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const initializeScreen = async () => {
    try {
      setIsLoading(true);
      await loadContent();
    } catch (error) {
      console.error('Failed to initialize home screen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      // Simulate API calls - replace with actual API endpoints
      const [recentlyPlayed, trendingTracks, recommendedTracks, featuredContent] =
        await Promise.all([
          fetchRecentlyPlayed(),
          fetchTrendingTracks(),
          fetchRecommendedTracks(),
          fetchFeaturedContent(),
        ]);

      const newSections: ContentSection[] = [
        {
          id: 'recently-played',
          title: 'Recently Played',
          items: recentlyPlayed,
          type: 'horizontal',
        },
        {
          id: 'trending',
          title: 'Trending Now',
          items: trendingTracks,
          type: 'horizontal',
        },
        {
          id: 'recommended',
          title: 'Recommended for You',
          items: recommendedTracks,
          type: 'grid',
        },
      ];

      setSections(newSections);
      setFeaturedTrack(featuredContent[0] || null);
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const fetchRecentlyPlayed = async (): Promise<AudioTrack[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: '1',
        title: 'Song One',
        artist: 'Artist A',
        album: 'Album 1',
        duration: 180,
        url: 'https://example.com/song1.mp3',
        artwork: 'https://picsum.photos/300/300?random=1',
        isLiked: false,
      },
      {
        id: '2',
        title: 'Song Two',
        artist: 'Artist B',
        album: 'Album 2',
        duration: 210,
        url: 'https://example.com/song2.mp3',
        artwork: 'https://picsum.photos/300/300?random=2',
        isLiked: true,
      },
      {
        id: '3',
        title: 'Song Three',
        artist: 'Artist C',
        album: 'Album 3',
        duration: 195,
        url: 'https://example.com/song3.mp3',
        artwork: 'https://picsum.photos/300/300?random=3',
        isLiked: false,
      },
    ];
  };

  const fetchTrendingTracks = async (): Promise<AudioTrack[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: '4',
        title: 'Trending Song',
        artist: 'Popular Artist',
        album: 'Hit Album',
        duration: 200,
        url: 'https://example.com/trending.mp3',
        artwork: 'https://picsum.photos/300/300?random=4',
        isLiked: false,
      },
      {
        id: '5',
        title: 'Viral Track',
        artist: 'Trending Artist',
        album: 'Viral EP',
        duration: 175,
        url: 'https://example.com/viral.mp3',
        artwork: 'https://picsum.photos/300/300?random=5',
        isLiked: true,
      },
    ];
  };

  const fetchRecommendedTracks = async (): Promise<AudioTrack[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: '6',
        title: 'Recommended Song',
        artist: 'Similar Artist',
        album: 'Discovery',
        duration: 220,
        url: 'https://example.com/recommended.mp3',
        artwork: 'https://picsum.photos/300/300?random=6',
        isLiked: false,
      },
    ];
  };

  const fetchFeaturedContent = async (): Promise<AudioTrack[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: 'featured-1',
        title: 'Featured Track of the Day',
        artist: 'Featured Artist',
        album: 'Featured Album',
        duration: 240,
        url: 'https://example.com/featured.mp3',
        artwork: 'https://picsum.photos/600/400?random=featured',
        isLiked: false,
      },
    ];
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    HapticFeedback.trigger(HapticFeedbackTypes.impactLight);

    try {
      await loadContent();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleTrackPress = useCallback(
    (track: AudioTrack, queue?: AudioTrack[]) => {
      HapticFeedback.trigger(HapticFeedbackTypes.selection);

      // Check if track is available offline when in offline mode
      if (isOfflineMode && !downloadedTracks.includes(track.id)) {
        // Show offline message or prompt to download
        return;
      }

      playTrack(track, queue);
    },
    [playTrack, isOfflineMode, downloadedTracks]
  );

  const handleSearchPress = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.selection);
    navigation.navigate('Search' as never);
  }, [navigation]);

  const handleProfilePress = useCallback(() => {
    HapticFeedback.trigger(HapticFeedbackTypes.selection);
    navigation.navigate('Profile' as never);
  }, [navigation]);

  const renderTrackItem = (track: AudioTrack, index: number, section: ContentSection) => {
    const isCurrentTrack = currentTrack?.id === track.id;
    const isDownloaded = downloadedTracks.includes(track.id);

    return (
      <TouchableOpacity
        key={track.id}
        style={[styles.trackItem, section.type === 'grid' && styles.gridTrackItem]}
        onPress={() => handleTrackPress(track, section.items)}
        activeOpacity={0.8}
      >
        <View style={styles.trackImageContainer}>
          <FastImage
            source={{
              uri: track.artwork || 'https://via.placeholder.com/120',
              priority: FastImage.priority.normal,
            }}
            style={styles.trackImage}
            resizeMode={FastImage.resizeMode.cover}
          />

          {/* Play indicator */}
          {isCurrentTrack && isPlaying && (
            <View style={styles.playIndicator}>
              <Icon name='volume-high' size={16} color='#fff' />
            </View>
          )}

          {/* Offline indicator */}
          {isDownloaded && (
            <View style={styles.downloadIndicator}>
              <Icon name='download' size={12} color='#1DB954' />
            </View>
          )}
        </View>

        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, isCurrentTrack && styles.currentTrackTitle]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {track.artist}
          </Text>
          <Text style={styles.trackDuration}>{formatDuration(track.duration)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (section: ContentSection) => {
    if (section.items.length === 0) return null;

    return (
      <View key={section.id} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={() => navigation.navigate('SectionView' as never, { section })}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Icon name='chevron-forward' size={16} color='#1DB954' />
          </TouchableOpacity>
        </View>

        {section.type === 'horizontal' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            decelerationRate='fast'
            snapToInterval={SCREEN_WIDTH * 0.35}
          >
            {section.items.map((track, index) => renderTrackItem(track, index, section))}
          </ScrollView>
        ) : (
          <View style={styles.gridContainer}>
            {section.items
              .slice(0, 6)
              .map((track, index) => renderTrackItem(track, index, section))}
          </View>
        )}
      </View>
    );
  };

  const renderFeaturedSection = () => {
    if (!featuredTrack) return null;

    return (
      <TouchableOpacity
        style={styles.featuredSection}
        onPress={() => handleTrackPress(featuredTrack)}
        activeOpacity={0.9}
      >
        <FastImage
          source={{
            uri: featuredTrack.artwork || 'https://via.placeholder.com/400x200',
            priority: FastImage.priority.high,
          }}
          style={styles.featuredImage}
          resizeMode={FastImage.resizeMode.cover}
        />

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.featuredOverlay}
        />

        <View style={styles.featuredContent}>
          <Text style={styles.featuredLabel}>Featured</Text>
          <Text style={styles.featuredTitle} numberOfLines={2}>
            {featuredTrack.title}
          </Text>
          <Text style={styles.featuredArtist} numberOfLines={1}>
            {featuredTrack.artist}
          </Text>

          <TouchableOpacity style={styles.featuredPlayButton}>
            <Icon name='play' size={20} color='#fff' />
            <Text style={styles.featuredPlayText}>Play Now</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor='#000' translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingText}>{greetingMessage}</Text>
          <Text style={styles.userName}>Music Lover</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={handleSearchPress}>
            <Icon name='search' size={24} color='#fff' />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerButton} onPress={handleProfilePress}>
            <Icon name='person-circle' size={28} color='#fff' />
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Mode Indicator */}
      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Icon name='cloud-offline' size={16} color='#FFA500' />
          <Text style={styles.offlineText}>You&apos;re in offline mode</Text>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor='#1DB954'
            colors={['#1DB954']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Section */}
        {renderFeaturedSection()}

        {/* Content Sections */}
        {sections.map(renderSection)}

        {/* Bottom spacing for mini player */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Mini Player */}
      <MiniPlayer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#FFA500',
    fontSize: 12,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for mini player
  },
  featuredSection: {
    height: 200,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  featuredLabel: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featuredArtist: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 12,
  },
  featuredPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  featuredPlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#1DB954',
    fontSize: 14,
    marginRight: 4,
  },
  horizontalScroll: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  trackItem: {
    width: SCREEN_WIDTH * 0.3,
    marginRight: 12,
  },
  gridTrackItem: {
    width: (SCREEN_WIDTH - 60) / 2,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  trackImageContainer: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  trackImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#333',
  },
  playIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(29, 185, 84, 0.9)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentTrackTitle: {
    color: '#1DB954',
  },
  trackArtist: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 2,
  },
  trackDuration: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
  bottomSpacing: {
    height: 60, // Match mini player height
  },
});

export default HomeScreen;
