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
  ContentCategory,
  ContentItem,
  CuratedCollection,
  TrendingCategory,
  ContentType,
  POPULAR_GENRES,
} from '../../types/discovery';
import ContentCard from '../../components/discovery/ContentCard';
import FeedSection from '../../components/discovery/FeedSection';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth } = Dimensions.get('window');

const CategoriesScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const {
    categories,
    getCategoryContent,
    getTrendingCategories,
    getCuratedCollections,
    loadCategories,
    user,
  } = useDiscovery();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null);
  const [trendingCategories, setTrendingCategories] = useState<TrendingCategory[]>([]);
  const [curatedCollections, setCuratedCollections] = useState<CuratedCollection[]>([]);
  const [categoryContent, setCategoryContent] = useState<{ [key: string]: ContentItem[] }>({});
  const [activeView, setActiveView] = useState<'grid' | 'featured'>('featured');
  
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
    
    // View Toggle
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.large,
      padding: 4,
    },
    viewToggleButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    viewToggleActive: {
      backgroundColor: theme.colors.primary,
    },
    viewToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    viewToggleTextActive: {
      color: 'white',
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
    
    // Featured Hero Section
    heroSection: {
      height: 240,
      marginBottom: 24,
    },
    heroItem: {
      width: screenWidth - 40,
      height: 200,
      marginHorizontal: 20,
      borderRadius: theme.borderRadius.large,
      overflow: 'hidden',
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    heroOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60%',
      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
      justifyContent: 'flex-end',
      padding: 20,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 4,
    },
    heroDescription: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      marginBottom: 8,
    },
    heroStats: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.7)',
    },
    
    // Categories Grid
    categoriesGrid: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    categoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    categoryItem: {
      width: (screenWidth - 56) / 2, // Account for padding and gap
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.large,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    categoryIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    categoryDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    categoryStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    categoryStatIcon: {
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    categoryStatText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    
    // Trending Section
    trendingSection: {
      marginBottom: 24,
    },
    trendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    trendingTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    trendingIcon: {
      fontSize: 24,
      marginRight: 8,
    },
    seeAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary + '20',
      borderRadius: theme.borderRadius.small,
    },
    seeAllText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Trending Categories Horizontal List
    trendingList: {
      paddingLeft: 20,
    },
    trendingCategoryItem: {
      width: 160,
      marginRight: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      overflow: 'hidden',
      position: 'relative',
    },
    trendingCategoryImage: {
      width: '100%',
      height: 100,
      resizeMode: 'cover',
    },
    trendingCategoryContent: {
      padding: 12,
    },
    trendingCategoryName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    trendingCategoryGrowth: {
      fontSize: 11,
      color: theme.colors.success,
      fontWeight: '500',
      marginBottom: 4,
    },
    trendingCategoryCount: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    trendingBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.small,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    trendingBadgeText: {
      fontSize: 10,
      color: 'white',
      fontWeight: 'bold',
    },
    
    // Genres Section
    genresSection: {
      marginBottom: 24,
    },
    genresHeader: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    genresTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    genresSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    genresContainer: {
      paddingHorizontal: 20,
    },
    genresRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    genreChip: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.large,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 8,
    },
    genreChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    genreChipText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    genreChipTextSelected: {
      color: 'white',
    },
    
    // Content Sections
    contentSections: {
      paddingBottom: 40,
    },
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load categories if not already loaded
        if (categories.length === 0) {
          await loadCategories();
        }

        // Load additional data in parallel
        const [trendingData, curatedData] = await Promise.all([
          getTrendingCategories(),
          getCuratedCollections(),
        ]);

        setTrendingCategories(trendingData);
        setCuratedCollections(curatedData);

        // Load content for first few categories
        if (categories.length > 0) {
          const contentPromises = categories.slice(0, 4).map(async (category) => {
            const content = await getCategoryContent(category.id, { limit: 6 });
            return { [category.id]: content };
          });

          const contentResults = await Promise.all(contentPromises);
          const contentMap = contentResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
          setCategoryContent(contentMap);
        }

      } catch (err) {
        console.error('Failed to load categories data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categories.length, loadCategories, getTrendingCategories, getCuratedCollections, getCategoryContent]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCategories();
      const [trendingData, curatedData] = await Promise.all([
        getTrendingCategories(),
        getCuratedCollections(),
      ]);
      setTrendingCategories(trendingData);
      setCuratedCollections(curatedData);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadCategories, getTrendingCategories, getCuratedCollections]);

  const handleCategoryPress = useCallback((category: ContentCategory) => {
    navigation.navigate('CategoryDetail' as never, { 
      categoryId: category.id,
      categoryName: category.name,
    } as never);
  }, [navigation]);

  const handleTrendingCategoryPress = useCallback((trendingCategory: TrendingCategory) => {
    const category = categories.find(cat => cat.id === trendingCategory.categoryId);
    if (category) {
      handleCategoryPress(category);
    }
  }, [categories, handleCategoryPress]);

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

  // Get personalized categories based on user preferences
  const personalizedCategories = useMemo(() => {
    if (!user?.preferences?.categories || user.preferences.categories.length === 0) {
      return categories;
    }

    const preferredIds = user.preferences.categories;
    const preferred = categories.filter(cat => preferredIds.includes(cat.id));
    const others = categories.filter(cat => !preferredIds.includes(cat.id));
    
    return [...preferred, ...others];
  }, [categories, user?.preferences?.categories]);

  // Render categories in grid format
  const renderCategoriesGrid = useCallback(() => {
    const rows = [];
    for (let i = 0; i < personalizedCategories.length; i += 2) {
      const rowCategories = personalizedCategories.slice(i, i + 2);
      rows.push(
        <View key={`row-${i}`} style={styles.categoryRow}>
          {rowCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryItem,
                selectedCategory?.id === category.id && styles.categoryItemSelected,
              ]}
              onPress={() => handleCategoryPress(category)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryDescription} numberOfLines={2}>
                {category.description}
              </Text>
              <View style={styles.categoryStats}>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatIcon}>📄</Text>
                  <Text style={styles.categoryStatText}>
                    {formatNumber(category.contentCount || 0)}
                  </Text>
                </View>
                <View style={styles.categoryStatItem}>
                  <Text style={styles.categoryStatIcon}>👤</Text>
                  <Text style={styles.categoryStatText}>
                    {formatNumber(category.creatorCount || 0)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {/* Add empty space if odd number */}
          {rowCategories.length === 1 && (
            <View style={[styles.categoryItem, { opacity: 0 }]} />
          )}
        </View>
      );
    }
    return rows;
  }, [personalizedCategories, selectedCategory, handleCategoryPress, formatNumber, styles]);

  const renderTrendingCategories = useCallback(() => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.trendingList}
    >
      {trendingCategories.map((trending, index) => {
        const category = categories.find(cat => cat.id === trending.categoryId);
        if (!category) return null;

        return (
          <TouchableOpacity
            key={trending.categoryId}
            style={styles.trendingCategoryItem}
            onPress={() => handleTrendingCategoryPress(trending)}
          >
            <Image
              source={{ uri: category.thumbnailUrl }}
              style={styles.trendingCategoryImage}
            />
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>#{index + 1}</Text>
            </View>
            <View style={styles.trendingCategoryContent}>
              <Text style={styles.trendingCategoryName}>{category.name}</Text>
              <Text style={styles.trendingCategoryGrowth}>
                +{trending.growthPercentage}% this week
              </Text>
              <Text style={styles.trendingCategoryCount}>
                {formatNumber(trending.contentCount)} new items
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  ), [trendingCategories, categories, handleTrendingCategoryPress, formatNumber, styles]);

  const renderGenresSection = useCallback(() => {
    const userGenres = user?.preferences?.genres || [];
    const sortedGenres = [...POPULAR_GENRES].sort((a, b) => {
      const aIsPreferred = userGenres.includes(a);
      const bIsPreferred = userGenres.includes(b);
      if (aIsPreferred && !bIsPreferred) return -1;
      if (!aIsPreferred && bIsPreferred) return 1;
      return 0;
    });

    return (
      <View style={styles.genresRow}>
        {sortedGenres.map((genre) => {
          const isSelected = userGenres.includes(genre);
          return (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                isSelected && styles.genreChipSelected,
              ]}
              onPress={() => {
                // Navigate to genre-specific content
                navigation.navigate('Search' as never, { 
                  initialQuery: genre,
                  filters: { genres: [genre] },
                } as never);
              }}
            >
              <Text style={[
                styles.genreChipText,
                isSelected && styles.genreChipTextSelected,
              ]}>
                {genre}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [user?.preferences?.genres, navigation, styles]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 16 }}>
            Loading categories...
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
        <Text style={styles.headerTitle}>Explore Categories</Text>
        <Text style={styles.headerSubtitle}>
          Discover amazing content across all genres
        </Text>
        
        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              activeView === 'featured' && styles.viewToggleActive,
            ]}
            onPress={() => setActiveView('featured')}
          >
            <Text style={[
              styles.viewToggleText,
              activeView === 'featured' && styles.viewToggleTextActive,
            ]}>
              Featured
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              activeView === 'grid' && styles.viewToggleActive,
            ]}
            onPress={() => setActiveView('grid')}
          >
            <Text style={[
              styles.viewToggleText,
              activeView === 'grid' && styles.viewToggleTextActive,
            ]}>
              All Categories
            </Text>
          </TouchableOpacity>
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
        {activeView === 'featured' ? (
          <View>
            {/* Hero Section for Curated Collections */}
            {curatedCollections.length > 0 && (
              <View style={styles.heroSection}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {curatedCollections.slice(0, 3).map((collection) => (
                    <TouchableOpacity
                      key={collection.id}
                      style={styles.heroItem}
                      onPress={() => {
                        navigation.navigate('CuratedCollection' as never, {
                          collectionId: collection.id,
                        } as never);
                      }}
                    >
                      <Image
                        source={{ uri: collection.thumbnailUrl }}
                        style={styles.heroImage}
                      />
                      <View style={styles.heroOverlay}>
                        <Text style={styles.heroTitle}>{collection.title}</Text>
                        <Text style={styles.heroDescription} numberOfLines={2}>
                          {collection.description}
                        </Text>
                        <Text style={styles.heroStats}>
                          {formatNumber(collection.itemCount)} items • Curated by {collection.curatorName}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Trending Categories */}
            {trendingCategories.length > 0 && (
              <View style={styles.trendingSection}>
                <View style={styles.trendingHeader}>
                  <Text style={styles.trendingIcon}>📈</Text>
                  <Text style={styles.trendingTitle}>Trending This Week</Text>
                  <TouchableOpacity style={styles.seeAllButton}>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                {renderTrendingCategories()}
              </View>
            )}

            {/* Popular Genres */}
            <View style={styles.genresSection}>
              <View style={styles.genresHeader}>
                <Text style={styles.genresTitle}>Popular Genres</Text>
                <Text style={styles.genresSubtitle}>
                  Explore content by musical and content genres
                </Text>
              </View>
              <View style={styles.genresContainer}>
                {renderGenresSection()}
              </View>
            </View>

            {/* Content Sections for Top Categories */}
            <View style={styles.contentSections}>
              {personalizedCategories.slice(0, 4).map((category) => {
                const content = categoryContent[category.id] || [];
                if (content.length === 0) return null;

                return (
                  <FeedSection
                    key={category.id}
                    title={category.name}
                    description={`Popular ${category.name.toLowerCase()} content`}
                    content={content}
                    layout="horizontal"
                    onSeeAll={() => handleCategoryPress(category)}
                    onContentPress={handleContentPress}
                    onCreatorPress={handleCreatorPress}
                    showSeeAll
                  />
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.categoriesGrid}>
            {renderCategoriesGrid()}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CategoriesScreen;