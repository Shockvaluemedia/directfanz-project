import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import { useAuth } from '../../contexts/AuthContext';

// Components
import FeedSection from '../../components/discovery/FeedSection';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

// Types
import { ContentItem, ContentCategory } from '../../types/discovery';
import { HomeStackParamList } from '../../types/navigation';
import { StackNavigationProp } from '@react-navigation/stack';

type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'HomeMain'>;

const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const {
    getFeedContent,
    getTrendingContent,
    getCategories,
  } = useDiscovery();

  // State
  const [feedContent, setFeedContent] = useState<ContentItem[]>([]);
  const [trendingContent, setTrendingContent] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    welcomeText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    welcomeSubtext: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 60,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
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
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setError(null);
      
      const [
        feedData,
        trendingData, 
        categoriesData,
      ] = await Promise.all([
        getFeedContent({ limit: 10 }),
        getTrendingContent({ limit: 10 }),
        getCategories(),
      ]);

      setFeedContent(feedData);
      setTrendingContent(trendingData);
      setCategories(categoriesData.slice(0, 8));
      
    } catch (err) {
      console.error('Failed to load home data:', err);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFeedContent, getTrendingContent, getCategories]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleContentPress = useCallback((content: ContentItem) => {
    navigation.navigate('ContentDetail', { 
      contentId: content.id,
      content 
    });
  }, [navigation]);

  const handleTrendingPress = useCallback(() => {
    navigation.navigate('Trending');
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Loading your content...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          {user ? `Hey, ${user.displayName?.split(' ')[0]}! 👋` : 'Welcome to Nahvee Even! 🎵'}
        </Text>
        <Text style={styles.welcomeSubtext}>
          Discover amazing content from talented creators
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Trending Section */}
        {trendingContent.length > 0 && (
          <View style={styles.section}>
            <FeedSection
              title="Trending Now"
              subtitle="What's popular today"
              content={trendingContent}
              onContentPress={handleContentPress}
              onSeeAllPress={handleTrendingPress}
            />
          </View>
        )}

        {/* Main Feed */}
        {feedContent.length > 0 && (
          <View style={styles.section}>
            <FeedSection
              title="Discover More"
              subtitle="Explore our diverse content library"
              content={feedContent}
              onContentPress={handleContentPress}
              onSeeAllPress={() => {
                // Navigate to main discover feed
              }}
            />
          </View>
        )}

        {/* Empty State */}
        {feedContent.length === 0 && trendingContent.length === 0 && (
          <EmptyState
            title="No content available"
            message="Check back soon for amazing content from our creators!"
            actionText="Refresh"
            onAction={handleRefresh}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;