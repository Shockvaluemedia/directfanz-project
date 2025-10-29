import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  RefreshControl,
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  CreatorInfo,
  ContentItem,
  CreatorStats,
} from '../../types/discovery';
import ContentCard from '../../components/discovery/ContentCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth } = Dimensions.get('window');

interface CreatorProfileScreenProps {
  route: RouteProp<{ params: { creatorId: string } }>;
}

const CreatorProfileScreen: React.FC<CreatorProfileScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { creatorId } = route.params as { creatorId: string };
  
  const {
    getCreatorById,
    getCreatorContent,
    getCreatorStats,
    toggleFollow,
    loadMoreCreatorContent,
  } = useDiscovery();

  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'about' | 'playlists'>('content');
  const [hasMoreContent, setHasMoreContent] = useState(true);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 280;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.error,
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
    
    // Animated Header
    animatedHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      backgroundColor: theme.colors.background,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 20,
      paddingBottom: 10,
      zIndex: 1000,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginHorizontal: 16,
    },
    
    // Profile Header
    profileHeader: {
      height: headerHeight,
      backgroundColor: theme.colors.surface,
      position: 'relative',
    },
    coverImage: {
      width: '100%',
      height: 180,
      backgroundColor: theme.colors.border,
    },
    profileContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    avatarContainer: {
      position: 'absolute',
      bottom: 40,
      left: 20,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.background,
      borderWidth: 3,
      borderColor: 'white',
    },
    profileInfo: {
      paddingLeft: 100,
      paddingTop: 20,
    },
    creatorName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 4,
    },
    creatorHandle: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 8,
    },
    followersCount: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '600',
    },
    
    // Profile Actions
    profileActions: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    followButton: {
      backgroundColor: theme.colors.primary,
    },
    followingButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    messageButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    shareButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flex: 0,
      paddingHorizontal: 16,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    followButtonText: {
      color: 'white',
    },
    followingButtonText: {
      color: theme.colors.primary,
    },
    messageButtonText: {
      color: theme.colors.text,
    },
    
    // Stats Section
    statsSection: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    
    // Tabs
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Content
    contentContainer: {
      flex: 1,
    },
    contentList: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    contentGrid: {
      paddingHorizontal: 10,
      paddingVertical: 16,
    },
    gridItem: {
      width: (screenWidth - 30) / 2,
      marginHorizontal: 5,
      marginBottom: 16,
    },
    
    // About Tab
    aboutContainer: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    bio: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
      marginBottom: 20,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    infoIcon: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginRight: 12,
      width: 20,
      textAlign: 'center',
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
    },
    socialLinks: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 20,
    },
    socialLink: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    
    // Load More
    loadMoreContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
  });

  // Load creator data
  useEffect(() => {
    const loadCreatorData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [creatorData, statsData] = await Promise.all([
          getCreatorById(creatorId),
          getCreatorStats(creatorId),
        ]);
        
        if (!creatorData) {
          throw new Error('Creator not found');
        }
        
        setCreator(creatorData);
        setCreatorStats(statsData);
        
        // Load initial content
        const contentData = await getCreatorContent(creatorId, { limit: 20 });
        setContent(contentData.items);
        setHasMoreContent(contentData.hasMore);
        
      } catch (err) {
        console.error('Failed to load creator data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load creator');
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [creatorId, getCreatorById, getCreatorStats, getCreatorContent]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [creatorData, statsData] = await Promise.all([
        getCreatorById(creatorId),
        getCreatorStats(creatorId),
      ]);
      
      setCreator(creatorData);
      setCreatorStats(statsData);
      
      const contentData = await getCreatorContent(creatorId, { limit: 20, offset: 0 });
      setContent(contentData.items);
      setHasMoreContent(contentData.hasMore);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [creatorId, getCreatorById, getCreatorStats, getCreatorContent]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMoreContent) return;
    
    setLoadingMore(true);
    try {
      const contentData = await loadMoreCreatorContent(creatorId, content.length);
      setContent(prev => [...prev, ...contentData.items]);
      setHasMoreContent(contentData.hasMore);
    } catch (error) {
      console.error('Failed to load more content:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreContent, creatorId, content.length, loadMoreCreatorContent]);

  const handleFollow = useCallback(async () => {
    if (!creator) return;
    
    try {
      await toggleFollow(creator.id);
      setCreator(prev => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followersCount: prev.isFollowing 
          ? prev.followersCount - 1 
          : prev.followersCount + 1,
      } : null);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  }, [creator, toggleFollow]);

  const handleShare = useCallback(async () => {
    if (!creator) return;
    
    try {
      await Share.share({
        message: `Check out ${creator.name} on Nahvee Even!`,
        url: `https://nahveeeven.com/creator/${creator.id}`,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [creator]);

  const handleContentPress = useCallback((content: ContentItem) => {
    navigation.navigate('ContentDetail' as never, { contentId: content.id } as never);
  }, [navigation]);

  const formatNumber = useCallback((num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }, []);

  const formatJoinDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }, []);

  // Animated header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderContentItem = useCallback(({ item, index }: { item: ContentItem; index: number }) => (
    <View style={activeTab === 'content' ? styles.gridItem : undefined}>
      <ContentCard
        content={item}
        layout={activeTab === 'content' ? 'grid' : 'vertical'}
        size="medium"
        onPress={handleContentPress}
        onCreatorPress={() => {}} // We're already on creator profile
        style={{ marginBottom: activeTab === 'content' ? 0 : 16 }}
      />
    </View>
  ), [activeTab, handleContentPress, styles.gridItem]);

  const renderAboutTab = useCallback(() => (
    <ScrollView style={styles.aboutContainer} showsVerticalScrollIndicator={false}>
      {creator?.bio && (
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{creator.bio}</Text>
        </View>
      )}

      <View style={{ marginBottom: 24 }}>
        <Text style={styles.sectionTitle}>Information</Text>
        
        {creator?.joinedAt && (
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>
              Joined {formatJoinDate(creator.joinedAt)}
            </Text>
          </View>
        )}
        
        {creator?.location && (
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{creator.location}</Text>
          </View>
        )}
        
        {creator?.website && (
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🌐</Text>
            <Text style={styles.infoText}>{creator.website}</Text>
          </View>
        )}
      </View>

      {creator?.socialLinks && creator.socialLinks.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Social Links</Text>
          <View style={styles.socialLinks}>
            {creator.socialLinks.map((link, index) => (
              <TouchableOpacity key={index} style={styles.socialLink}>
                <Text style={{ fontSize: 20 }}>
                  {link.platform === 'twitter' ? '🐦' :
                   link.platform === 'instagram' ? '📷' :
                   link.platform === 'youtube' ? '▶️' :
                   link.platform === 'tiktok' ? '🎵' : '🔗'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  ), [creator, formatJoinDate, styles]);

  const renderLoadMoreFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <LoadingSpinner size="small" />
        <Text style={styles.loadMoreText}>Loading more content...</Text>
      </View>
    );
  }, [loadingMore, styles]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadMoreText}>Loading creator...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !creator) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Creator not found'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              // Retry loading would be implemented here
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 18, color: theme.colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {creator.name}
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Text style={{ fontSize: 16, color: theme.colors.text }}>↗</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image source={{ uri: creator.coverImage }} style={styles.coverImage} />
          <View style={styles.profileContent}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: creator.avatar }} style={styles.avatar} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.creatorName}>
                {creator.name}
                {creator.isVerified && ' ✓'}
              </Text>
              <Text style={styles.creatorHandle}>@{creator.handle}</Text>
              <Text style={styles.followersCount}>
                {formatNumber(creator.followersCount)} followers
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Actions */}
        <View style={styles.profileActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              creator.isFollowing ? styles.followingButton : styles.followButton,
            ]}
            onPress={handleFollow}
          >
            <Text style={[
              styles.actionButtonText,
              creator.isFollowing ? styles.followingButtonText : styles.followButtonText,
            ]}>
              {creator.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.messageButton]}>
            <Text style={[styles.actionButtonText, styles.messageButtonText]}>
              Message
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShare}
          >
            <Text style={{ fontSize: 18 }}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        {creatorStats && (
          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatNumber(creatorStats.totalContent)}
                </Text>
                <Text style={styles.statLabel}>Content</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatNumber(creatorStats.totalViews)}
                </Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatNumber(creatorStats.totalLikes)}
                </Text>
                <Text style={styles.statLabel}>Likes</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {creatorStats.averageRating.toFixed(1)}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {(['content', 'about', 'playlists'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}>
                {tab === 'content' ? 'Content' :
                 tab === 'about' ? 'About' : 'Playlists'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'content' && (
            content.length > 0 ? (
              <FlatList
                data={content}
                renderItem={renderContentItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.contentGrid}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderLoadMoreFooter}
                scrollEnabled={false}
              />
            ) : (
              <EmptyState
                icon="📱"
                title="No Content Yet"
                description={`${creator.name} hasn't published any content yet.`}
              />
            )
          )}
          
          {activeTab === 'about' && renderAboutTab()}
          
          {activeTab === 'playlists' && (
            <EmptyState
              icon="📋"
              title="No Playlists"
              description={`${creator.name} hasn't created any playlists yet.`}
            />
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
};

export default CreatorProfileScreen;