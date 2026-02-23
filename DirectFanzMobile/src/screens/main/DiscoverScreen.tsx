import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { POPULAR_GENRES, ContentType, CONTENT_TYPE_LABELS } from '../../types/discovery';
import { DiscoverStackParamList } from '../../types/navigation';
import CreatorCard from '../../components/discovery/CreatorCard';
import ContentItem from '../../components/discovery/ContentItem';
import LinearGradient from 'react-native-linear-gradient';

type TabType = 'all' | 'creators' | 'content';
type ViewMode = 'trending' | 'search' | 'genres';

const { width } = Dimensions.get('window');

type DiscoverScreenNavigationProp = NativeStackNavigationProp<DiscoverStackParamList, 'DiscoverMain'>;

const DiscoverScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<DiscoverScreenNavigationProp>();
  const {
    searchQuery,
    searchResults,
    trendingData,
    recommendedCreators,
    recommendedContent,
    isLoading,
    isSearching,
    error,
    search,
    setSearchQuery,
    clearSearch,
    fetchTrending,
  } = useDiscovery();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('trending');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!trendingData) {
      fetchTrending();
    }
  }, [trendingData, fetchTrending]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setViewMode('search');
      await search({ 
        query: query.trim(),
        type: activeTab === 'all' ? undefined : activeTab,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      });
    } else {
      clearSearch();
      setViewMode('trending');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTrending();
      if (searchQuery) {
        await handleSearch(searchQuery);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenreToggle = (genre: string) => {
    const updatedGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter(g => g !== genre)
      : [...selectedGenres, genre];
    
    setSelectedGenres(updatedGenres);
    setViewMode('genres');
    
    if (searchQuery || updatedGenres.length > 0) {
      search({ 
        query: searchQuery,
        type: activeTab === 'all' ? undefined : activeTab,
        genres: updatedGenres.length > 0 ? updatedGenres : undefined,
      });
    }
  };

  const handleCreatorPress = (creatorId: string) => {
    navigation.navigate('ViewCreatorProfile', { creatorId });
  };

  const handleContentPress = (contentId: string) => {
    // TODO: Navigate to content player/viewer
    console.log('Navigate to content:', contentId);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      paddingVertical: 12,
    },
    clearButton: {
      padding: 8,
    },
    clearButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    tabsContainer: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activeTab: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    activeTabText: {
      color: 'white',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    section: {
      marginVertical: 15,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    seeAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    seeAllText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    genresContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
    },
    genreTag: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 12,
      marginBottom: 8,
      borderWidth: 1,
    },
    genreTagActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    genreTagInactive: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    genreTagText: {
      fontSize: 12,
      fontWeight: '500',
    },
    genreTagTextActive: {
      color: 'white',
    },
    genreTagTextInactive: {
      color: theme.colors.text,
    },
    creatorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    horizontalList: {
      paddingLeft: 20,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: 40,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
    gradientCard: {
      borderRadius: 16,
      padding: 20,
      marginVertical: 10,
      alignItems: 'center',
    },
    gradientText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    gradientSubtext: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 14,
      textAlign: 'center',
    },
  });

  const renderTabs = () => {
    const tabs: { key: TabType; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'creators', label: 'Creators' },
      { key: 'content', label: 'Content' },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderGenres = () => {
    return (
      <View style={styles.genresContainer}>
        {POPULAR_GENRES.slice(0, 12).map((genre) => {
          const isSelected = selectedGenres.includes(genre);
          return (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreTag,
                isSelected ? styles.genreTagActive : styles.genreTagInactive,
              ]}
              onPress={() => handleGenreToggle(genre)}
            >
              <Text
                style={[
                  styles.genreTagText,
                  isSelected ? styles.genreTagTextActive : styles.genreTagTextInactive,
                ]}
              >
                {genre}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderSearchResults = () => {
    const { creators, content } = searchResults;
    const showCreators = activeTab === 'all' || activeTab === 'creators';
    const showContent = activeTab === 'all' || activeTab === 'content';

    if ((isSearching || isLoading) && (!creators.length && !content.length)) {
      return <Text style={styles.loadingText}>Searching...</Text>;
    }

    if (!creators.length && !content.length) {
      return (
        <Text style={styles.emptyText}>
          No results found for "{searchQuery}"
        </Text>
      );
    }

    return (
      <>
        {showCreators && creators.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Creators ({creators.length})
              </Text>
            </View>
            <View style={styles.creatorsGrid}>
              {creators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  onPress={() => handleCreatorPress(creator.id)}
                />
              ))}
            </View>
          </View>
        )}

        {showContent && content.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Content ({content.length})
              </Text>
            </View>
            {content.map((item) => (
              <ContentItem
                key={item.id}
                content={item}
                onPress={() => handleContentPress(item.id)}
                onCreatorPress={() => handleCreatorPress(item.creator.id)}
              />
            ))}
          </View>
        )}
      </>
    );
  };

  const renderTrending = () => {
    if (!trendingData) {
      return <Text style={styles.loadingText}>Loading trending content...</Text>;
    }

    const showCreators = activeTab === 'all' || activeTab === 'creators';
    const showContent = activeTab === 'all' || activeTab === 'content';

    return (
      <>
        {/* Hero Section */}
        <View style={styles.section}>
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.gradientCard}
          >
            <Text style={styles.gradientText}>Discover Amazing Creators</Text>
            <Text style={styles.gradientSubtext}>
              Find new artists, exclusive content, and join a vibrant community
              of creators and fans.
            </Text>
          </LinearGradient>
        </View>

        {/* Trending Creators */}
        {showCreators && trendingData.trendingCreators.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Trending Creators</Text>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={trendingData.trendingCreators}
              renderItem={({ item }) => (
                <CreatorCard
                  creator={item}
                  style="card"
                  onPress={() => handleCreatorPress(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Recommended Content */}
        {showContent && recommendedContent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>✨ Recommended for You</Text>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {recommendedContent.slice(0, 3).map((item) => (
              <ContentItem
                key={item.id}
                content={item}
                onPress={() => handleContentPress(item.id)}
                onCreatorPress={() => handleCreatorPress(item.creator.id)}
              />
            ))}
          </View>
        )}

        {/* New Creators */}
        {showCreators && trendingData.newCreators.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🌟 New Creators</Text>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={trendingData.newCreators}
              renderItem={({ item }) => (
                <CreatorCard
                  creator={item}
                  style="compact"
                  onPress={() => handleCreatorPress(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}
      </>
    );
  };

  const renderContent = () => {
    if (error) {
      return <Text style={styles.errorText}>Error: {error}</Text>;
    }

    switch (viewMode) {
      case 'search':
        return renderSearchResults();
      case 'genres':
        return renderSearchResults();
      default:
        return renderTrending();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search creators and content..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => handleSearch('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        
        {renderTabs()}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Genre Filters */}
        {renderGenres()}
        
        {/* Main Content */}
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
