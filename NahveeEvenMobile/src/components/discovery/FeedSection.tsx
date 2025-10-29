import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { FeedSection as FeedSectionType, ContentItem } from '../../types/discovery';
import ContentCard, { ContentCardLayout } from './ContentCard';

interface FeedSectionProps {
  section: FeedSectionType;
  layout?: ContentCardLayout;
  onContentPress?: (content: ContentItem) => void;
  onCreatorPress?: (creatorId: string) => void;
  onSeeAllPress?: (section: FeedSectionType) => void;
  onLoadMore?: (sectionId: string) => void;
}

const FeedSectionComponent: React.FC<FeedSectionProps> = memo(({
  section,
  layout = 'horizontal',
  onContentPress,
  onCreatorPress,
  onSeeAllPress,
  onLoadMore,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    sectionIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 8,
    },
    indicator: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary + '20',
    },
    indicatorText: {
      fontSize: 10,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    trendingIndicator: {
      backgroundColor: theme.colors.warning + '20',
    },
    trendingIndicatorText: {
      color: theme.colors.warning,
    },
    refreshableIndicator: {
      backgroundColor: theme.colors.success + '20',
    },
    refreshableIndicatorText: {
      color: theme.colors.success,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemCount: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    seeAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.small,
    },
    seeAllButtonText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    content: {
      paddingVertical: 8,
    },
    horizontalContent: {
      paddingHorizontal: 16,
    },
    gridContent: {
      paddingHorizontal: 20,
    },
    emptyState: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    loadingMore: {
      padding: 16,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });

  const handleContentPress = useCallback((content: ContentItem) => {
    onContentPress?.(content);
  }, [onContentPress]);

  const handleCreatorPress = useCallback((creatorId: string) => {
    onCreatorPress?.(creatorId);
  }, [onCreatorPress]);

  const handleSeeAllPress = useCallback(() => {
    onSeeAllPress?.(section);
  }, [onSeeAllPress, section]);

  const handleEndReached = useCallback(() => {
    if (section.hasMore) {
      onLoadMore?.(section.id);
    }
  }, [section.hasMore, section.id, onLoadMore]);

  const renderContentItem = useCallback(({ item }: { item: ContentItem }) => (
    <ContentCard
      content={item}
      layout={layout}
      size="medium"
      onPress={handleContentPress}
      onCreatorPress={handleCreatorPress}
      showActions={layout !== 'horizontal'}
      showStats={layout === 'vertical'}
      style={layout === 'horizontal' ? { marginRight: 12 } : undefined}
    />
  ), [layout, handleContentPress, handleCreatorPress]);

  const renderItemSeparator = useCallback(() => {
    if (layout === 'horizontal') {
      return <View style={{ width: 8 }} />;
    }
    if (layout === 'grid') {
      return <View style={{ height: 12 }} />;
    }
    return null;
  }, [layout]);

  const getContentContainerStyle = useCallback(() => {
    switch (layout) {
      case 'horizontal':
        return styles.horizontalContent;
      case 'grid':
        return styles.gridContent;
      default:
        return styles.content;
    }
  }, [layout, styles]);

  const getSectionTypeLabel = useCallback((type: FeedSectionType['type']): string => {
    switch (type) {
      case 'trending':
        return '🔥 Trending';
      case 'recommended':
        return '✨ For You';
      case 'category':
        return '📁 Category';
      case 'creator':
        return '👤 Creator';
      case 'new':
        return '🆕 New';
      case 'popular':
        return '⭐ Popular';
      case 'featured':
        return '🎯 Featured';
      case 'personalized':
        return '🎨 Personalized';
      default:
        return '';
    }
  }, []);

  if (!section.items || section.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{section.title}</Text>
            {section.description && (
              <Text style={styles.subtitle}>{section.description}</Text>
            )}
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No content available in this section yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{section.title}</Text>
          {section.description && (
            <Text style={styles.subtitle}>{section.description}</Text>
          )}
          
          {/* Section Indicators */}
          <View style={styles.sectionIndicators}>
            <View style={styles.indicator}>
              <Text style={styles.indicatorText}>
                {getSectionTypeLabel(section.type)}
              </Text>
            </View>
            
            {section.type === 'trending' && (
              <View style={[styles.indicator, styles.trendingIndicator]}>
                <Text style={[styles.indicatorText, styles.trendingIndicatorText]}>
                  HOT
                </Text>
              </View>
            )}
            
            {section.refreshable && (
              <View style={[styles.indicator, styles.refreshableIndicator]}>
                <Text style={[styles.indicatorText, styles.refreshableIndicatorText]}>
                  LIVE
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          {section.items.length > 0 && (
            <Text style={styles.itemCount}>
              {section.items.length} item{section.items.length !== 1 ? 's' : ''}
            </Text>
          )}
          
          {section.hasMore && (
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={handleSeeAllPress}
            >
              <Text style={styles.seeAllButtonText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section Content */}
      <View style={styles.content}>
        <FlatList
          data={section.items}
          renderItem={renderContentItem}
          keyExtractor={(item) => `${section.id}-${item.id}`}
          horizontal={layout === 'horizontal'}
          numColumns={layout === 'grid' ? 2 : undefined}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={getContentContainerStyle()}
          ItemSeparatorComponent={renderItemSeparator}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={layout === 'horizontal'}
          maxToRenderPerBatch={layout === 'horizontal' ? 5 : 10}
          windowSize={layout === 'horizontal' ? 5 : 10}
          ListFooterComponent={
            section.hasMore ? (
              <View style={styles.loadingMore}>
                <Text style={styles.loadingText}>Loading more...</Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
});

FeedSectionComponent.displayName = 'FeedSection';

export default FeedSectionComponent;