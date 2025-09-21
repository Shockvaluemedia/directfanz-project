import React, { memo, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { 
  SearchSuggestion, 
  TrendingSearch, 
  ContentType, 
  ContentCategory,
  POPULAR_GENRES,
} from '../../types/discovery';

interface SearchSuggestionsProps {
  visible: boolean;
  query: string;
  suggestions: SearchSuggestion[];
  trendingSearches: TrendingSearch[];
  recentSearches: string[];
  categories: ContentCategory[];
  onSuggestionPress: (suggestion: string) => void;
  onTrendingPress: (query: string) => void;
  onCategoryPress: (category: ContentCategory) => void;
  onGenrePress: (genre: string) => void;
  onClearRecentSearches: () => void;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = memo(({
  visible,
  query,
  suggestions,
  trendingSearches,
  recentSearches,
  categories,
  onSuggestionPress,
  onTrendingPress,
  onCategoryPress,
  onGenrePress,
  onClearRecentSearches,
}) => {
  const { theme } = useTheme();
  const { user } = useDiscovery();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.medium,
      marginTop: 4,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      maxHeight: 400,
    },
    section: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionLast: {
      borderBottomWidth: 0,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    clearButton: {
      padding: 4,
    },
    clearButtonText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    
    // Suggestions Items
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionIcon: {
      width: 20,
      height: 20,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionIconText: {
      fontSize: 14,
    },
    suggestionContent: {
      flex: 1,
    },
    suggestionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    suggestionHighlight: {
      fontWeight: '600',
      color: theme.colors.primary,
    },
    suggestionMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    // Trending Searches
    trendingContainer: {
      paddingHorizontal: 16,
    },
    trendingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    trendingRank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    trendingRankText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'white',
    },
    trendingContent: {
      flex: 1,
    },
    trendingQuery: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: '500',
    },
    trendingCount: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    trendingArrow: {
      fontSize: 12,
      color: theme.colors.success,
      marginLeft: 8,
    },
    
    // Categories Grid
    categoriesGrid: {
      paddingHorizontal: 16,
    },
    categoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    categoryItem: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    categoryIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    categoryName: {
      fontSize: 11,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
    
    // Genres Chips
    genresContainer: {
      paddingHorizontal: 16,
    },
    genresScroll: {
      paddingRight: 16,
    },
    genreChip: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.large,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
    },
    genreText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    
    // Empty State
    emptyContainer: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Highlight search query in suggestions
  const highlightQuery = useCallback((text: string, query: string) => {
    if (!query || query.length === 0) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <Text key={index} style={styles.suggestionHighlight}>{part}</Text>
      ) : (
        <Text key={index}>{part}</Text>
      )
    );
  }, [styles.suggestionHighlight]);

  // Get suggestion icon based on type
  const getSuggestionIcon = useCallback((suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'QUERY':
        return '🔍';
      case 'CREATOR':
        return '👤';
      case 'CONTENT':
        return '📄';
      case 'TAG':
        return '#️⃣';
      default:
        return '🔍';
    }
  }, []);

  // Format search count
  const formatSearchCount = useCallback((count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  }, []);

  // Personalized categories based on user activity
  const personalizedCategories = useMemo(() => {
    if (!user?.preferences?.categories) return categories.slice(0, 8);
    
    const preferredCategoryIds = user.preferences.categories;
    const preferred = categories.filter(cat => preferredCategoryIds.includes(cat.id));
    const others = categories.filter(cat => !preferredCategoryIds.includes(cat.id));
    
    return [...preferred, ...others].slice(0, 8);
  }, [categories, user?.preferences?.categories]);

  // Popular genres filtered by user preference
  const personalizedGenres = useMemo(() => {
    if (!user?.preferences?.genres) return POPULAR_GENRES.slice(0, 10);
    
    const preferredGenres = user.preferences.genres;
    const preferred = POPULAR_GENRES.filter(genre => preferredGenres.includes(genre));
    const others = POPULAR_GENRES.filter(genre => !preferredGenres.includes(genre));
    
    return [...preferred, ...others].slice(0, 10);
  }, [user?.preferences?.genres]);

  if (!visible) return null;

  // If we have a query and suggestions, show suggestions
  if (query && suggestions.length > 0) {
    return (
      <View style={styles.container}>
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `${item.type}-${item.value}-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.suggestionItem,
                index === suggestions.length - 1 && styles.suggestionItemLast,
              ]}
              onPress={() => onSuggestionPress(item.value)}
            >
              <View style={styles.suggestionIcon}>
                <Text style={styles.suggestionIconText}>
                  {getSuggestionIcon(item)}
                </Text>
              </View>
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionText}>
                  {highlightQuery(item.value, query)}
                </Text>
                {item.meta && (
                  <Text style={styles.suggestionMeta}>{item.meta}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // If we have a query but no suggestions, show empty state
  if (query && suggestions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No suggestions found for "{query}"
          </Text>
        </View>
      </View>
    );
  }

  // Default state: show recent searches, trending, categories, and genres
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={onClearRecentSearches}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.slice(0, 5).map((search, index) => (
              <TouchableOpacity
                key={`recent-${index}`}
                style={[
                  styles.suggestionItem,
                  index === Math.min(4, recentSearches.length - 1) && styles.suggestionItemLast,
                ]}
                onPress={() => onSuggestionPress(search)}
              >
                <View style={styles.suggestionIcon}>
                  <Text style={styles.suggestionIconText}>🕐</Text>
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionText}>{search}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Trending Searches */}
        {trendingSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trending</Text>
            </View>
            <View style={styles.trendingContainer}>
              {trendingSearches.slice(0, 5).map((trending, index) => (
                <TouchableOpacity
                  key={`trending-${index}`}
                  style={styles.trendingItem}
                  onPress={() => onTrendingPress(trending.query)}
                >
                  <View style={styles.trendingRank}>
                    <Text style={styles.trendingRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.trendingContent}>
                    <Text style={styles.trendingQuery}>{trending.query}</Text>
                    <Text style={styles.trendingCount}>
                      {formatSearchCount(trending.searchCount)} searches
                    </Text>
                  </View>
                  <Text style={styles.trendingArrow}>📈</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Categories */}
        {personalizedCategories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Browse Categories</Text>
            </View>
            <View style={styles.categoriesGrid}>
              {Array.from({ length: Math.ceil(personalizedCategories.length / 2) }).map((_, rowIndex) => (
                <View key={`category-row-${rowIndex}`} style={styles.categoryRow}>
                  {personalizedCategories.slice(rowIndex * 2, (rowIndex + 1) * 2).map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.categoryItem}
                      onPress={() => onCategoryPress(category)}
                    >
                      <Text style={styles.categoryIcon}>{category.icon}</Text>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {/* Add empty space for odd number of categories */}
                  {personalizedCategories.length % 2 !== 0 && rowIndex === Math.floor(personalizedCategories.length / 2) && (
                    <View style={[styles.categoryItem, { opacity: 0 }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Popular Genres */}
        {personalizedGenres.length > 0 && (
          <View style={[styles.section, styles.sectionLast]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Genres</Text>
            </View>
            <View style={styles.genresContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genresScroll}
              >
                {personalizedGenres.map((genre, index) => (
                  <TouchableOpacity
                    key={`genre-${index}`}
                    style={styles.genreChip}
                    onPress={() => onGenrePress(genre)}
                  >
                    <Text style={styles.genreText}>{genre}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
});

SearchSuggestions.displayName = 'SearchSuggestions';

export default SearchSuggestions;