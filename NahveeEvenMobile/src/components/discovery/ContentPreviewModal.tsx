import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import {
  PanGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { useTheme } from '../../hooks/useTheme';
import { ContentItem, PurchaseOption } from '../../types/discovery';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ContentPreviewModalProps {
  visible: boolean;
  content: ContentItem | null;
  onClose: () => void;
  onPurchase: (option: PurchaseOption) => void;
  onPlay: () => void;
  onLike: () => void;
  onBookmark: () => void;
  onShare: () => void;
}

const ContentPreviewModal: React.FC<ContentPreviewModalProps> = ({
  visible,
  content,
  onClose,
  onPurchase,
  onPlay,
  onLike,
  onBookmark,
  onShare,
}) => {
  const { theme } = useTheme();
  const [selectedPurchaseOption, setSelectedPurchaseOption] = useState<PurchaseOption | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [showPurchaseOptions, setShowPurchaseOptions] = useState(false);
  
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const previewTimer = useRef<NodeJS.Timeout | null>(null);

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    modalContent: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      marginTop: 100,
      overflow: 'hidden',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // Preview Media
    previewContainer: {
      position: 'relative',
      backgroundColor: '#000',
      aspectRatio: 16 / 9,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    previewOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    playIcon: {
      fontSize: 20,
      color: theme.colors.primary,
      marginLeft: 2,
    },
    previewBadge: {
      position: 'absolute',
      top: 16,
      left: 16,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.medium,
    },
    previewBadgeText: {
      fontSize: 12,
      color: 'white',
      fontWeight: '600',
    },
    previewTimer: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    previewTimerText: {
      fontSize: 12,
      color: 'white',
      fontWeight: '600',
    },
    
    // Content Info
    contentInfo: {
      padding: 20,
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    creatorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    creatorAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.border,
      marginRight: 12,
    },
    creatorName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    stats: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 20,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    
    // Actions
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      marginBottom: 20,
    },
    actionButton: {
      alignItems: 'center',
      padding: 8,
    },
    actionIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    actionLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    actionLabelActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Purchase Section
    purchaseSection: {
      marginTop: 'auto',
    },
    previewMessage: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: theme.borderRadius.medium,
      marginBottom: 16,
    },
    previewMessageText: {
      fontSize: 14,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
    previewHighlight: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    
    // Purchase Options
    purchaseOptionsContainer: {
      maxHeight: 200,
    },
    purchaseOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      marginBottom: 8,
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
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    purchaseOptionDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    purchaseOptionPrice: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    
    // Bottom Actions
    bottomActions: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 16,
    },
    bottomButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });

  // Animation for modal appearance
  useEffect(() => {
    if (visible) {
      setPreviewTime(0);
      setSelectedPurchaseOption(content?.purchaseOptions?.[0] || null);
      setShowPurchaseOptions(false);
      
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start();

      // Start preview timer
      previewTimer.current = setInterval(() => {
        setPreviewTime(prev => prev + 1);
      }, 1000);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: screenHeight,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start();

      if (previewTimer.current) {
        clearInterval(previewTimer.current);
      }
    }

    return () => {
      if (previewTimer.current) {
        clearInterval(previewTimer.current);
      }
    };
  }, [visible, content, opacity, translateY]);

  const handlePanGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      if (translationY > 0) {
        translateY.setValue(translationY);
      }
    } else if (state === State.END) {
      if (translationY > 100 || velocityY > 1000) {
        onClose();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [translateY, onClose]);

  const handlePurchase = useCallback(() => {
    if (selectedPurchaseOption) {
      onPurchase(selectedPurchaseOption);
      onClose();
    }
  }, [selectedPurchaseOption, onPurchase, onClose]);

  const formatNumber = useCallback((num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isFree = content?.purchaseOptions?.some(option => option.price === 0) || false;
  const canPlay = content?.isPurchased || isFree;

  if (!visible || !content) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.modalContainer, { opacity }]}>
        <PanGestureHandler onGestureEvent={handlePanGesture}>
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY }] }
            ]}
          >
            {/* Handle */}
            <View style={styles.handle} />
            
            {/* Header */}
            <View style={styles.header}>
              <View style={{ width: 32 }} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Preview
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={{ fontSize: 16, color: theme.colors.text }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Preview Media */}
            <View style={styles.previewContainer}>
              <Image source={{ uri: content.thumbnail }} style={styles.previewImage} />
              <View style={styles.previewOverlay}>
                {canPlay ? (
                  <TouchableOpacity style={styles.playButton} onPress={onPlay}>
                    <Text style={styles.playIcon}>▶</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.playButton} 
                    onPress={() => setShowPurchaseOptions(true)}
                  >
                    <Text style={styles.playIcon}>🔒</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {!canPlay && (
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>PREVIEW</Text>
                </View>
              )}
              
              <View style={styles.previewTimer}>
                <Text style={styles.previewTimerText}>
                  {formatTime(previewTime)}
                </Text>
              </View>
            </View>

            {/* Content Info */}
            <View style={styles.contentInfo}>
              <Text style={styles.title} numberOfLines={2}>
                {content.title}
              </Text>
              
              <View style={styles.creatorInfo}>
                <Image 
                  source={{ uri: content.creator.avatar }} 
                  style={styles.creatorAvatar} 
                />
                <Text style={styles.creatorName}>
                  {content.creator.name}
                  {content.creator.isVerified && ' ✓'}
                </Text>
              </View>

              {/* Stats */}
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {formatNumber(content.viewsCount)}
                  </Text>
                  <Text style={styles.statLabel}>Views</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {formatNumber(content.likesCount)}
                  </Text>
                  <Text style={styles.statLabel}>Likes</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {content.rating.toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={onLike}>
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

                <TouchableOpacity style={styles.actionButton} onPress={onBookmark}>
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

                <TouchableOpacity style={styles.actionButton} onPress={onShare}>
                  <Text style={[styles.actionIcon, { color: theme.colors.textSecondary }]}>
                    📤
                  </Text>
                  <Text style={styles.actionLabel}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Purchase Section */}
              <View style={styles.purchaseSection}>
                {!canPlay && (
                  <View style={styles.previewMessage}>
                    <Text style={styles.previewMessageText}>
                      You're viewing a <Text style={styles.previewHighlight}>preview</Text>.{'\n'}
                      Get full access to enjoy the complete content.
                    </Text>
                  </View>
                )}

                {/* Purchase Options */}
                {(!canPlay || showPurchaseOptions) && content.purchaseOptions && (
                  <View style={styles.purchaseOptionsContainer}>
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
                  </View>
                )}

                {/* Bottom Actions */}
                <View style={styles.bottomActions}>
                  {canPlay ? (
                    <>
                      <TouchableOpacity style={[styles.bottomButton, styles.secondaryButton]} onPress={onClose}>
                        <Text style={styles.secondaryButtonText}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.bottomButton, styles.primaryButton]} onPress={onPlay}>
                        <Text style={styles.primaryButtonText}>Play Full Content</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity 
                        style={[styles.bottomButton, styles.secondaryButton]} 
                        onPress={() => setShowPurchaseOptions(!showPurchaseOptions)}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {showPurchaseOptions ? 'Hide Options' : 'View Options'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.bottomButton, styles.primaryButton]} 
                        onPress={handlePurchase}
                        disabled={!selectedPurchaseOption}
                      >
                        <Text style={styles.primaryButtonText}>
                          {selectedPurchaseOption?.price === 0 
                            ? 'Get Free Access' 
                            : `Purchase $${selectedPurchaseOption?.price?.toFixed(2) || '0.00'}`}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </Modal>
  );
};

export default ContentPreviewModal;