import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Share,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDiscovery } from '../../contexts/DiscoveryContext';
import {
  ContentItem,
  CreatorInfo,
  ContentType,
  PurchaseOption,
} from '../../types/discovery';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ContentDetailScreenProps {
  route: RouteProp<{ params: { contentId: string } }>;
}

const ContentDetailScreen: React.FC<ContentDetailScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { contentId } = route.params as { contentId: string };
  
  const {
    getContentById,
    toggleLike,
    toggleBookmark,
    toggleFollow,
    purchaseContent,
    getRelatedContent,
    getCreatorContent,
  } = useDiscovery();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([]);
  const [creatorContent, setCreatorContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [selectedPurchaseOption, setSelectedPurchaseOption] = useState<PurchaseOption | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

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
    
    // Header
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 100 : 80,
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
    
    // Content Media
    mediaContainer: {
      width: screenWidth,
      height: screenWidth * 0.75, // 4:3 aspect ratio
      backgroundColor: theme.colors.surface,
      position: 'relative',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    mediaOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playButton: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 80,
      height: 80,
      marginTop: -40,
      marginLeft: -40,
      borderRadius: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    playIcon: {
      fontSize: 32,
      color: theme.colors.primary,
      marginLeft: 4, // Center the play icon
    },
    mediaBadges: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      gap: 8,
    },
    mediaBadge: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    mediaBadgeText: {
      fontSize: 12,
      color: 'white',
      fontWeight: '600',
    },
    
    // Content Info
    contentInfo: {
      padding: 20,
    },
    contentTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
      lineHeight: 32,
    },
    contentSubtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 22,
    },
    
    // Creator Info
    creatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
    },
    creatorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
      marginRight: 12,
    },
    creatorInfo: {
      flex: 1,
    },
    creatorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    creatorStats: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    followButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    followButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    followButtonTextActive: {
      color: 'white',
    },
    
    // Stats and Actions
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginVertical: 20,
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
    
    // Actions Row
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      marginBottom: 20,
    },
    actionButton: {
      alignItems: 'center',
      padding: 12,
      minWidth: 60,
    },
    actionIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    actionLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    actionLabelActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Description
    descriptionContainer: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
    },
    showMoreButton: {
      marginTop: 8,
    },
    showMoreText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Purchase Options
    purchaseContainer: {
      marginBottom: 24,
    },
    purchaseOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    purchaseOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    purchaseOptionInfo: {
      flex: 1,
    },
    purchaseOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    purchaseOptionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    purchaseOptionPrice: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    
    // Purchase Button
    purchaseButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
      marginBottom: 24,
    },
    purchaseButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
    purchaseButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: 'white',
    },
    
    // Related Content
    relatedContainer: {
      marginBottom: 24,
    },
    relatedList: {
      paddingLeft: 20,
    },
    relatedItem: {
      width: 200,
      marginRight: 16,
    },
    relatedImage: {
      width: '100%',
      height: 120,
      borderRadius: theme.borderRadius.medium,
      backgroundColor: theme.colors.surface,
      marginBottom: 8,
    },
    relatedTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    relatedCreator: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });

  // Load content data
  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const contentData = await getContentById(contentId);
        if (!contentData) {
          throw new Error('Content not found');
        }
        
        setContent(contentData);
        
        // Load related content and creator's other content in parallel
        const [related, creatorOther] = await Promise.all([
          getRelatedContent(contentId),
          getCreatorContent(contentData.creator.id, { exclude: contentId, limit: 10 }),
        ]);
        
        setRelatedContent(related);
        setCreatorContent(creatorOther);
        
      } catch (err) {
        console.error('Failed to load content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [contentId, getContentById, getRelatedContent, getCreatorContent]);

  // Animate header opacity based on scroll
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      const opacity = Math.min(value / 200, 1);
      headerOpacity.setValue(opacity);
    });

    return () => scrollY.removeListener(listener);
  }, [scrollY, headerOpacity]);

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
      Alert.alert('Error', 'Failed to update like status');
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
      Alert.alert('Error', 'Failed to update bookmark status');
    }
  }, [content, toggleBookmark]);

  const handleFollow = useCallback(async () => {
    if (!content) return;
    
    try {
      await toggleFollow(content.creator.id);
      setContent(prev => prev ? {
        ...prev,
        creator: {
          ...prev.creator,
          isFollowing: !prev.creator.isFollowing,
          followersCount: prev.creator.isFollowing 
            ? prev.creator.followersCount - 1 
            : prev.creator.followersCount + 1,
        },
      } : null);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  }, [content, toggleFollow]);

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

  const handlePurchase = useCallback(async () => {
    if (!content || !selectedPurchaseOption) return;
    
    try {
      setPurchasing(true);
      await purchaseContent(content.id, selectedPurchaseOption.id);
      
      Alert.alert(
        'Purchase Successful!',
        `You now have access to "${content.title}". You can find it in your library.`,
        [
          { text: 'View Content', onPress: () => handlePlay() },
          { text: 'OK', style: 'cancel' },
        ]
      );
      
      // Update content to reflect ownership
      setContent(prev => prev ? {
        ...prev,
        isPurchased: true,
      } : null);
      
    } catch (error) {
      console.error('Failed to purchase content:', error);
      Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }, [content, selectedPurchaseOption, purchaseContent]);

  const handlePlay = useCallback(() => {
    if (!content) return;
    
    // Navigate to content player
    navigation.navigate('ContentPlayer' as never, { 
      contentId: content.id,
      content: content,
    } as never);
  }, [content, navigation]);

  const handleCreatorPress = useCallback(() => {
    if (!content) return;
    
    navigation.navigate('CreatorProfile' as never, {
      creatorId: content.creator.id,
    } as never);
  }, [content, navigation]);

  const handleRelatedContentPress = useCallback((relatedContent: ContentItem) => {
    navigation.push('ContentDetail' as never, {
      contentId: relatedContent.id,
    } as never);
  }, [navigation]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
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

  // Determine if content is free or requires purchase
  const isFree = useMemo(() => {
    return content?.purchaseOptions?.some(option => option.price === 0) || false;
  }, [content?.purchaseOptions]);

  const canPlay = useMemo(() => {
    return content?.isPurchased || isFree;
  }, [content?.isPurchased, isFree]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Loading content...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !content) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Content not found'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              // Retry loading
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
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      
      {/* Animated Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 18, color: theme.colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {content.title}
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Text style={{ fontSize: 16, color: theme.colors.text }}>↗</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Container */}
        <View style={styles.mediaContainer}>
          <Image source={{ uri: content.thumbnail }} style={styles.mediaImage} />
          <View style={styles.mediaOverlay} />
          
          {/* Media Badges */}
          <View style={styles.mediaBadges}>
            {content.duration && (
              <View style={styles.mediaBadge}>
                <Text style={styles.mediaBadgeText}>
                  {formatDuration(content.duration)}
                </Text>
              </View>
            )}
            {content.isLive && (
              <View style={[styles.mediaBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.mediaBadgeText}>LIVE</Text>
              </View>
            )}
            {content.isPremium && (
              <View style={[styles.mediaBadge, { backgroundColor: theme.colors.warning }]}>
                <Text style={styles.mediaBadgeText}>PREMIUM</Text>
              </View>
            )}
          </View>

          {/* Play Button */}
          {canPlay && (
            <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
              <Text style={styles.playIcon}>▶</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content Information */}
        <View style={styles.contentInfo}>
          <Text style={styles.contentTitle}>{content.title}</Text>
          {content.subtitle && (
            <Text style={styles.contentSubtitle}>{content.subtitle}</Text>
          )}

          {/* Creator Information */}
          <TouchableOpacity style={styles.creatorContainer} onPress={handleCreatorPress}>
            <Image
              source={{ uri: content.creator.avatar }}
              style={styles.creatorAvatar}
            />
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorName}>
                {content.creator.name}
                {content.creator.isVerified && ' ✓'}
              </Text>
              <Text style={styles.creatorStats}>
                {formatNumber(content.creator.followersCount)} followers
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.followButton,
                content.creator.isFollowing && styles.followButtonActive,
              ]}
              onPress={handleFollow}
            >
              <Text style={[
                styles.followButtonText,
                content.creator.isFollowing && styles.followButtonTextActive,
              ]}>
                {content.creator.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(content.viewsCount)}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(content.likesCount)}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{content.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Text style={[
                styles.actionIcon,
                { color: content.isLiked ? theme.colors.error : theme.colors.textSecondary }
              ]}>
                {content.isLiked ? '❤️' : '🤍'}
              </Text>
              <Text style={[
                styles.actionLabel,
                content.isLiked && styles.actionLabelActive,
              ]}>
                {content.isLiked ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleBookmark}>
              <Text style={[
                styles.actionIcon,
                { color: content.isBookmarked ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                {content.isBookmarked ? '🔖' : '🏷️'}
              </Text>
              <Text style={[
                styles.actionLabel,
                content.isBookmarked && styles.actionLabelActive,
              ]}>
                {content.isBookmarked ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Text style={[styles.actionIcon, { color: theme.colors.textSecondary }]}>
                📤
              </Text>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          {content.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text
                style={styles.description}
                numberOfLines={showFullDescription ? undefined : 3}
              >
                {content.description}
              </Text>
              {content.description.length > 150 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullDescription(!showFullDescription)}
                >
                  <Text style={styles.showMoreText}>
                    {showFullDescription ? 'Show Less' : 'Show More'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Purchase Options */}
          {!canPlay && content.purchaseOptions && content.purchaseOptions.length > 0 && (
            <View style={styles.purchaseContainer}>
              <Text style={styles.sectionTitle}>Get Access</Text>
              {content.purchaseOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.purchaseOption,
                    selectedPurchaseOption?.id === option.id && styles.purchaseOptionSelected,
                  ]}
                  onPress={() => setSelectedPurchaseOption(option)}
                >
                  <View style={styles.purchaseOptionInfo}>
                    <Text style={styles.purchaseOptionTitle}>{option.title}</Text>
                    <Text style={styles.purchaseOptionDescription}>
                      {option.description}
                    </Text>
                  </View>
                  <Text style={styles.purchaseOptionPrice}>
                    {option.price === 0 ? 'FREE' : `$${option.price.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {selectedPurchaseOption && (
                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    purchasing && styles.purchaseButtonDisabled,
                  ]}
                  onPress={handlePurchase}
                  disabled={purchasing}
                >
                  <Text style={styles.purchaseButtonText}>
                    {purchasing ? 'Processing...' : 
                     selectedPurchaseOption.price === 0 ? 'Get Free Access' :
                     `Purchase for $${selectedPurchaseOption.price.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Related Content */}
          {relatedContent.length > 0 && (
            <View style={styles.relatedContainer}>
              <Text style={styles.sectionTitle}>Related Content</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedList}
              >
                {relatedContent.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.relatedItem}
                    onPress={() => handleRelatedContentPress(item)}
                  >
                    <Image
                      source={{ uri: item.thumbnail }}
                      style={styles.relatedImage}
                    />
                    <Text style={styles.relatedTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.relatedCreator} numberOfLines={1}>
                      {item.creator.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Creator's Other Content */}
          {creatorContent.length > 0 && (
            <View style={styles.relatedContainer}>
              <Text style={styles.sectionTitle}>
                More from {content.creator.name}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedList}
              >
                {creatorContent.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.relatedItem}
                    onPress={() => handleRelatedContentPress(item)}
                  >
                    <Image
                      source={{ uri: item.thumbnail }}
                      style={styles.relatedImage}
                    />
                    <Text style={styles.relatedTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.relatedCreator}>
                      {formatNumber(item.viewsCount)} views
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
};

export default ContentDetailScreen;