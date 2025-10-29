import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentItem,
  CreatorInfo,
  ContentCategory,
  TrendingTimeframe,
  TrendingMetric,
  ContentType,
} from '../../types/discovery';
import ContentCard from '../../components/discovery/ContentCard';
import FeedSection from '../../components/discovery/FeedSection';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth } = Dimensions.get('window');

const TrendingScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const {
    getTrendingContent,
    getTrendingCreators,
    getTrendingCategories,
    categories,
  } = useDiscovery();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Trending Data
  const [trendingContent, setTrendingContent] = useState<ContentItem[]>([]);
  const [trendingCreators, setTrendingCreators] = useState<CreatorInfo[]>([]);
  const [viralContent, setViralContent] = useState<ContentItem[]>([]);
  const [risingContent, setRisingContent] = useState<ContentItem[]>([]);
  
  // Filters
  const [timeframe, setTimeframe] = useState<TrendingTimeframe>('day');
  const [metric, setMetric] = useState<TrendingMetric>('views');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  
  const scrollY = useRef(new Animated.Value(0)).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    
    // Filters Section
    filtersSection: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginRight: 12,
      minWidth: 80,
    },
    filterOptions: {
      flexDirection: 'row',
      flex: 1,
      gap: 8,
    },
    filterButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.medium,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    filterButtonTextActive: {
      color: 'white',
    },
    
    // Stats Banner
    statsBanner: {
      backgroundColor: theme.colors.primary + '10',
      marginHorizontal: 20,
      marginVertical: 16,
      padding: 16,
      borderRadius: theme.borderRadius.large,
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    statsBannerTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 8,
    },
    statsBannerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    
    // Hero Section
    heroSection: {
      height: 280,
      marginBottom: 24,
    },
    heroItem: {
      width: screenWidth - 40,
      marginHorizontal: 20,
      borderRadius: theme.borderRadius.large,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.colors.surface,
    },
    heroImage: {
      width: '100%',
      height: 180,
      resizeMode: 'cover',
    },
    heroOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
      padding: 20,
    },
    heroBadge: {
      position: 'absolute',
      top: 16,
      left: 16,
      backgroundColor: theme.colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    heroBadgeText: {
      fontSize: 12,
      color: 'white',
      fontWeight: 'bold',
    },
    heroContent: {
      padding: 16,
      backgroundColor: theme.colors.background,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 4,
      position: 'absolute',
      bottom: 60,
      left: 20,
      right: 20,
    },
    heroCreator: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      position: 'absolute',
      bottom: 40,
      left: 20,
      right: 20,
    },
    heroStats: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    heroCreatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    heroCreatorAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
      backgroundColor: theme.colors.border,
    },
    heroCreatorName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    heroMetrics: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroMetric: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    heroMetricIcon: {
      fontSize: 12,
    },
    heroMetricText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    
    // Trending Creators Section
    trendingCreatorsSection: {
      marginBottom: 24,
    },
    creatorsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    creatorsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    creatorsIcon: {
      fontSize: 24,
      marginRight: 8,
    },
    creatorsList: {
      paddingLeft: 20,
    },
    creatorItem: {
      width: 120,
      alignItems: 'center',
      marginRight: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    creatorAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      marginBottom: 8,
      backgroundColor: theme.colors.border,
    },
    creatorName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    creatorGrowth: {
      fontSize: 10,
      color: theme.colors.success,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 2,
    },
    creatorFollowers: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    
    // Loading States
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
  });

  // Load trending data
  useEffect(() => {
    const loadTrendingData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load all trending data in parallel
        const [content, creators, viral, rising] = await Promise.all([
          getTrendingContent({ 
            timeframe, 
            metric, 
            categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
            limit: 20,
          }),
          getTrendingCreators({ timeframe, limit: 10 }),
          getTrendingContent({ 
            timeframe: 'day', 
            metric: 'engagement',
            viral: true,
            limit: 10,
          }),
          getTrendingContent({ 
            timeframe: 'hour', 
            metric: 'growth',
            rising: true,
            limit: 10,
          }),
        ]);

        setTrendingContent(content);
        setTrendingCreators(creators);
        setViralContent(viral);
        setRisingContent(rising);

      } catch (err) {
        console.error('Failed to load trending data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trending content');
      } finally {
        setLoading(false);
      }
    };

    loadTrendingData();
  }, [getTrendingContent, getTrendingCreators, timeframe, metric, selectedCategory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [content, creators, viral, rising] = await Promise.all([
        getTrendingContent({ 
          timeframe, 
          metric, 
          categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
          limit: 20,
        }),
        getTrendingCreators({ timeframe, limit: 10 }),
        getTrendingContent({ 
          timeframe: 'day', 
          metric: 'engagement',
          viral: true,
          limit: 10,
        }),
        getTrendingContent({ 
          timeframe: 'hour', 
          metric: 'growth',
          rising: true,
          limit: 10,
        }),
      ]);

      setTrendingContent(content);
      setTrendingCreators(creators);
      setViralContent(viral);
      setRisingContent(rising);
    } catch (error) {
      console.error('Failed to refresh trending data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [getTrendingContent, getTrendingCreators, timeframe, metric, selectedCategory]);

  const handleContentPress = useCallback((content: ContentItem) => {
    navigation.navigate('ContentDetail' as never, { contentId: content.id } as never);
  }, [navigation]);

  const handleCreatorPress = useCallback((creatorId: string) => {
    navigation.navigate('CreatorProfile' as never, { creatorId } as never);
  }, [navigation]);

  const formatNumber = useCallback((num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }, []);

  const formatGrowth = useCallback((growth: number) => {
    return growth > 0 ? `+${growth}%` : `${growth}%`;
  }, []);

  // Filter options
  const timeframeOptions: Array<{ value: TrendingTimeframe; label: string }> = [
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  const metricOptions: Array<{ value: TrendingMetric; label: string }> = [
    { value: 'views', label: 'Views' },
    { value: 'likes', label: 'Likes' },
    { value: 'shares', label: 'Shares' },
    { value: 'engagement', label: 'Engagement' },
  ];

  // Get trending stats
  const trendingStats = useMemo(() => {
    const totalViews = trendingContent.reduce((sum, item) => sum + item.viewsCount, 0);
    const totalLikes = trendingContent.reduce((sum, item) => sum + item.likesCount, 0);
    const totalCreators = new Set(trendingContent.map(item => item.creator.id)).size;
    const avgEngagement = trendingContent.length > 0 
      ? (totalLikes / totalViews * 100) 
      : 0;

    return {
      totalViews: formatNumber(totalViews),
      totalCreators: formatNumber(totalCreators),
      avgEngagement: avgEngagement.toFixed(1) + '%',
    };
  }, [trendingContent, formatNumber]);

  const renderHeroContent = useCallback(() => {
    const topContent = trendingContent[0];
    if (!topContent) return null;

    return (
      <TouchableOpacity 
        style={styles.heroItem}
        onPress={() => handleContentPress(topContent)}
      >
        <Image source={{ uri: topContent.thumbnail }} style={styles.heroImage} />
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>#1 TRENDING</Text>
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {topContent.title}
        </Text>
        <Text style={styles.heroCreator}>
          by {topContent.creator.name}
        </Text>
        <Text style={styles.heroStats}>
          {formatNumber(topContent.viewsCount)} views • {formatNumber(topContent.likesCount)} likes
        </Text>
        <View style={styles.heroFooter}>
          <TouchableOpacity
            style={styles.heroCreatorInfo}
            onPress={() => handleCreatorPress(topContent.creator.id)}
          >
            <Image
              source={{ uri: topContent.creator.avatar }}
              style={styles.heroCreatorAvatar}
            />
            <Text style={styles.heroCreatorName}>{topContent.creator.name}</Text>
          </TouchableOpacity>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricIcon}>👁</Text>
              <Text style={styles.heroMetricText}>{formatNumber(topContent.viewsCount)}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricIcon}>❤️</Text>
              <Text style={styles.heroMetricText}>{formatNumber(topContent.likesCount)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [trendingContent, handleContentPress, handleCreatorPress, formatNumber, styles]);

  const renderTrendingCreators = useCallback(() => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.creatorsList}
    >
      {trendingCreators.map((creator, index) => (
        <TouchableOpacity
          key={creator.id}
          style={styles.creatorItem}
          onPress={() => handleCreatorPress(creator.id)}
        >
          <Image source={{ uri: creator.avatar }} style={styles.creatorAvatar} />
          <Text style={styles.creatorName} numberOfLines={2}>
            {creator.name}
          </Text>
          <Text style={styles.creatorGrowth}>
            {formatGrowth(creator.growthRate || 0)}
          </Text>
          <Text style={styles.creatorFollowers}>
            {formatNumber(creator.followersCount)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ), [trendingCreators, handleCreatorPress, formatNumber, formatGrowth, styles]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 16 }}>
            Loading trending content...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔥 Trending</Text>
        <Text style={styles.headerSubtitle}>
          What's hot on Nahvee Even right now
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <View style={styles.filtersRow}>
          <Text style={styles.filterLabel}>Time:</Text>
          <View style={styles.filterOptions}>
            {timeframeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  timeframe === option.value && styles.filterButtonActive,
                ]}
                onPress={() => setTimeframe(option.value)}
              >
                <Text style={[
                  styles.filterButtonText,
                  timeframe === option.value && styles.filterButtonTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.filtersRow}>
          <Text style={styles.filterLabel}>Metric:</Text>
          <View style={styles.filterOptions}>
            {metricOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  metric === option.value && styles.filterButtonActive,
                ]}
                onPress={() => setMetric(option.value)}
              >
                <Text style={[
                  styles.filterButtonText,
                  metric === option.value && styles.filterButtonTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Stats Banner */}
        <View style={styles.statsBanner}>
          <Text style={styles.statsBannerTitle}>Trending Right Now</Text>
          <View style={styles.statsBannerContent}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{trendingStats.totalViews}</Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{trendingStats.totalCreators}</Text>
              <Text style={styles.statLabel}>Creators</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{trendingStats.avgEngagement}</Text>
              <Text style={styles.statLabel}>Avg Engagement</Text>
            </View>
          </View>
        </View>

        {/* Hero Section - Top Trending */}
        {trendingContent.length > 0 && (
          <View style={styles.heroSection}>
            {renderHeroContent()}
          </View>
        )}

        {/* Trending Creators */}
        {trendingCreators.length > 0 && (
          <View style={styles.trendingCreatorsSection}>
            <View style={styles.creatorsHeader}>
              <Text style={styles.creatorsIcon}>⭐</Text>
              <Text style={styles.creatorsTitle}>Rising Creators</Text>
            </View>
            {renderTrendingCreators()}
          </View>
        )}

        {/* Viral Content */}
        {viralContent.length > 0 && (
          <FeedSection
            title="🚀 Going Viral"
            description="Content that's exploding in popularity"
            content={viralContent}
            layout="horizontal"
            onContentPress={handleContentPress}
            onCreatorPress={handleCreatorPress}
            showSeeAll
          />
        )}

        {/* Rising Content */}
        {risingContent.length > 0 && (
          <FeedSection
            title="📈 Rising Fast"
            description="New content gaining momentum"
            content={risingContent}
            layout="horizontal"
            onContentPress={handleContentPress}
            onCreatorPress={handleCreatorPress}
            showSeeAll
          />
        )}

        {/* Main Trending List */}
        {trendingContent.length > 1 && (
          <FeedSection
            title="🔥 Trending Content"
            description={`Top ${metric} for the ${timeframe}`}
            content={trendingContent.slice(1)} // Skip the first item as it's in the hero
            layout="vertical"
            onContentPress={handleContentPress}
            onCreatorPress={handleCreatorPress}
            showSeeAll
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrendingScreen;