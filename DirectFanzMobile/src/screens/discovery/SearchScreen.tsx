import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentItem,
  CreatorInfo,
  SearchFilters as SearchFiltersType,
  SearchSuggestion,
  TrendingSearch,
  DISCOVERY_CONSTANTS,
  ContentType,
  ContentCategory,
  SortOption,
} from '../../types/discovery';

// Import components
import ContentCard from '../../components/discovery/ContentCard';
import SearchFilters from '../../components/discovery/SearchFilters';
import SearchSuggestions from '../../components/discovery/SearchSuggestions';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

interface SearchScreenProps {}

const SearchScreen: React.FC<SearchScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    searchQuery,
    searchResults,
    searchFilters,
    searchLoading,
    searchError,
    searchHistory,
    searchSuggestions,
    trendingSearches,
    categories,
    search,
    setSearchQuery,
    setSearchFilters,
    clearSearch,
    getSearchSuggestions,
    loadMoreSearchResults,
    loadCategories,
    clearSearchHistory,
  } = useDiscovery();

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'content' | 'creators'>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      height: 44,
      fontSize: 16,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    searchIcon: {
      marginRight: 8,
    },
    clearButton: {
      padding: 4,
      marginLeft: 8,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.medium,
      marginLeft: 12,
    },
    filterButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
    },
    filterBadge: {
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
    },
    filterBadgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    tabsContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.large,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    tabTextActive: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    
    // Suggestions Overlay
    suggestionsOverlay: {
      position: 'absolute',
      top: 88, // Adjust based on header height
      left: 20,
      right: 20,
      zIndex: 1000,
    },
    
    // Results
    resultsContainer: {
      flex: 1,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    resultsCount: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.small,
    },
    sortButtonText: {
      fontSize: 12,
      color: theme.colors.text,
      marginLeft: 4,
    },
    resultsList: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    loadMoreContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    
    // States
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

  // Load categories on mount
  useEffect(() => {
    if (categories.length === 0) {
      loadCategories();
    }
  }, [categories.length, loadCategories]);

  // Handle search input changes with debouncing
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (localQuery.length >= DISCOVERY_CONSTANTS.MIN_SEARCH_QUERY_LENGTH) {
      debounceTimeoutRef.current = setTimeout(() => {
        getSearchSuggestions(localQuery);
        setShowSuggestions(true);
      }, DISCOVERY_CONSTANTS.SEARCH_DEBOUNCE_DELAY);
    } else if (localQuery.length === 0) {
      clearSearch();
      setShowSuggestions(false);
    } else {
      setShowSuggestions(localQuery.length > 0);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [localQuery, getSearchSuggestions, clearSearch]);

  // Focus search input when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }, [])
  );

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < DISCOVERY_CONSTANTS.MIN_SEARCH_QUERY_LENGTH) return;

    try {
      await search({ 
        query: query.trim(),
        type: activeTab === 'all' ? undefined : activeTab === 'content' ? 'content' : 'creators',
        ...searchFilters,
      });
      setShowSuggestions(false);
    } catch (error) {
      Alert.alert('Error', 'Search failed. Please try again.');
    }
  }, [search, activeTab, searchFilters]);

  const handleQueryChange = useCallback((text: string) => {
    setLocalQuery(text);
    setSearchQuery(text);
    
    if (text.length >= DISCOVERY_CONSTANTS.MIN_SEARCH_QUERY_LENGTH) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [setSearchQuery]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setLocalQuery(suggestion);
    setSearchQuery(suggestion);
    handleSearch(suggestion);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [setSearchQuery, handleSearch]);

  const handleTrendingPress = useCallback((query: string) => {
    setLocalQuery(query);
    setSearchQuery(query);
    handleSearch(query);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [setSearchQuery, handleSearch]);

  const handleCategoryPress = useCallback((category: ContentCategory) => {
    // Set category filter and search
    const newFilters = {
      ...searchFilters,
      categories: [category.id],
    };
    setSearchFilters(newFilters);
    setLocalQuery(category.name);
    setSearchQuery(category.name);
    handleSearch(category.name);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [searchFilters, setSearchFilters, setSearchQuery, handleSearch]);

  const handleGenrePress = useCallback((genre: string) => {
    // Set genre filter and search
    const newFilters = {
      ...searchFilters,
      genres: [genre],
    };
    setSearchFilters(newFilters);
    setLocalQuery(genre);
    setSearchQuery(genre);
    handleSearch(genre);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [searchFilters, setSearchFilters, setSearchQuery, handleSearch]);

  const handleClearRecentSearches = useCallback(async () => {
    try {
      await clearSearchHistory();
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, [clearSearchHistory]);

  const handleClearSearch = useCallback(() => {
    setLocalQuery('');
    clearSearch();
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const handleFiltersChange = useCallback((filters: Partial<SearchFiltersType>) => {
    setSearchFilters({ ...searchFilters, ...filters });
  }, [searchFilters, setSearchFilters]);

  const handleApplyFilters = useCallback(() => {
    setShowFilters(false);
    if (localQuery) {
      handleSearch(localQuery);
    }
  }, [localQuery, handleSearch]);

  const handleClearFilters = useCallback(() => {
    setSearchFilters({
      genres: [],
      contentTypes: [],
      categories: [],
      priceRange: { min: 0, max: 1000, includeFree: true },
      duration: { min: 0, max: 3600 },
      rating: { min: 0 },
      tags: [],
      creators: [],
      languages: ['en'],
      verifiedOnly: false,
      sortBy: 'relevance',
    });
  }, [setSearchFilters]);

  const handleRefresh = useCallback(async () => {
    if (!localQuery) return;
    
    setRefreshing(true);
    try {
      await handleSearch(localQuery);
    } catch (error) {
      console.error('Failed to refresh search:', error);
    } finally {
      setRefreshing(false);
    }
  }, [localQuery, handleSearch]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !searchResults?.hasMore) return;
    
    setLoadingMore(true);
    try {
      await loadMoreSearchResults();
    } catch (error) {
      console.error('Failed to load more results:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, searchResults?.hasMore, loadMoreSearchResults]);

  const getActiveFiltersCount = useCallback(() => {
    let count = 0;
    
    if (searchFilters.genres?.length) count += searchFilters.genres.length;
    if (searchFilters.contentTypes?.length) count += searchFilters.contentTypes.length;
    if (searchFilters.categories?.length) count += searchFilters.categories.length;
    if (searchFilters.priceRange?.min !== 0 || searchFilters.priceRange?.max !== 1000) count += 1;
    if (searchFilters.duration?.min !== 0 || searchFilters.duration?.max !== 3600) count += 1;
    if (searchFilters.rating?.min !== 0) count += 1;
    if (searchFilters.verifiedOnly) count += 1;
    
    return count;
  }, [searchFilters]);

  // Computed values
  const hasActiveFilters = useMemo(() => getActiveFiltersCount() > 0, [getActiveFiltersCount]);
  const showEmptySearch = !searchQuery && searchHistory.length === 0;
  const showSuggestionsPanel = showSuggestions || (!localQuery && !searchQuery);
  const showResults = searchResults && searchQuery;

  const handleContentPress = useCallback((content: ContentItem) => {
    navigation.navigate('ContentDetail' as never, { contentId: content.id } as never);
  }, [navigation]);

  const handleCreatorPress = useCallback((creatorId: string) => {
    navigation.navigate('CreatorProfile' as never, { creatorId } as never);
  }, [navigation]);

  const renderContentResult = useCallback(({ item }: { item: ContentItem }) => (
    <ContentCard
      content={item}
      layout="vertical"
      size="medium"
      onPress={handleContentPress}
      onCreatorPress={handleCreatorPress}
      style={{ marginBottom: 16 }}
    />
  ), [handleContentPress, handleCreatorPress]);

  const renderLoadMoreFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadMoreText}>Loading more results...</Text>
      </View>
    );
  }, [loadingMore, theme.colors.primary, styles]);


  const getTabResults = useCallback(() => {
    if (!searchResults) return [];

    switch (activeTab) {
      case 'content':
        return searchResults.content;
      case 'creators':
        return searchResults.creators;
      case 'all':
      default:
        return [...searchResults.content, ...searchResults.creators];
    }
  }, [searchResults, activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Text style={[styles.searchIcon, { color: theme.colors.textSecondary }]}>🔍</Text>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={localQuery}
            onChangeText={handleQueryChange}
            placeholder="Search content, creators, genres..."
            placeholderTextColor={theme.colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => localQuery && handleSearch(localQuery)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay hiding suggestions to allow for tap events
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {localQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearSearch}
            >
              <Text style={{ color: theme.colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button & Tabs */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.tabsContainer}>
            {(['all', 'content', 'creators'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'all' ? 'All' : tab === 'content' ? 'Content' : 'Creators'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Text style={{ color: 'white' }}>⚙️</Text>
            <Text style={styles.filterButtonText}>Filters</Text>
            {hasActiveFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Suggestions Overlay */}
      {showSuggestionsPanel && (
        <View style={styles.suggestionsOverlay}>
          <SearchSuggestions
            visible={true}
            query={localQuery}
            suggestions={searchSuggestions}
            trendingSearches={trendingSearches || []}
            recentSearches={searchHistory}
            categories={categories}
            onSuggestionPress={handleSuggestionPress}
            onTrendingPress={handleTrendingPress}
            onCategoryPress={handleCategoryPress}
            onGenrePress={handleGenrePress}
            onClearRecentSearches={handleClearRecentSearches}
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Loading State */}
        {searchLoading && (
          <View style={styles.loadingContainer}>
            <LoadingSpinner size="large" />
            <Text style={styles.loadMoreText}>Searching...</Text>
          </View>
        )}

        {/* Error State */}
        {searchError && !searchLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{searchError}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => localQuery && handleSearch(localQuery)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty Search State */}
        {showEmptySearch && !searchLoading && !showSuggestionsPanel && (
          <EmptyState
            icon="🔍"
            title="Search Nahvee Even"
            description="Find your favorite content, creators, and genres using the search above."
          />
        )}

        {/* Search Results */}
        {showResults && !searchLoading && !showSuggestionsPanel && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {searchResults?.totalContent + searchResults?.totalCreators} results
              </Text>
              <TouchableOpacity style={styles.sortButton}>
                <Text style={{ color: theme.colors.textSecondary }}>↕️</Text>
                <Text style={styles.sortButtonText}>{searchFilters.sortBy || 'Relevance'}</Text>
              </TouchableOpacity>
            </View>

            {getTabResults().length > 0 ? (
              <FlatList
                data={getTabResults()}
                renderItem={renderContentResult}
                keyExtractor={(item) => `result-${item.id}`}
                contentContainerStyle={styles.resultsList}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderLoadMoreFooter}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.primary}
                    colors={[theme.colors.primary]}
                  />
                }
              />
            ) : (
              <EmptyState
                icon="😔"
                title="No Results Found"
                description="Try adjusting your search terms or filters to find what you're looking for."
                action={
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => setShowFilters(true)}
                  >
                    <Text style={styles.retryButtonText}>Adjust Filters</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        )}
      </View>

      {/* Advanced Filters Modal */}
      <SearchFilters
        visible={showFilters}
        filters={searchFilters}
        categories={categories}
        onFiltersChange={handleFiltersChange}
        onApply={handleApplyFilters}
        onClose={() => setShowFilters(false)}
        onClear={handleClearFilters}
      />
    </SafeAreaView>
  );
};

export default SearchScreen;