import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import { 
  UploadHistoryItem, 
  ContentMetadata,
  UPLOAD_CONSTANTS,
} from '../../types/upload';

// Import common components
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const { width } = Dimensions.get('window');

interface PublishedContent extends UploadHistoryItem {
  views: number;
  likes: number;
  downloads: number;
  revenue: number;
  isPublished: boolean;
  publishDate?: string;
}

const ContentManagementScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { state, updateContentMetadata } = useUpload();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContent, setEditingContent] = useState<PublishedContent | null>(null);
  const [publishedContent, setPublishedContent] = useState<PublishedContent[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'revenue'>('date');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    headerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary,
    },
    headerButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.colors.text,
    },
    filtersContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.large,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      color: theme.colors.text,
    },
    filterChipTextActive: {
      color: 'white',
    },
    content: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    contentItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
      overflow: 'hidden',
    },
    contentItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    contentImage: {
      width: '100%',
      height: 120,
      backgroundColor: theme.colors.border,
    },
    contentInfo: {
      padding: 16,
    },
    contentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    contentTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
      marginRight: 12,
    },
    publishStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.success + '20',
    },
    publishStatusText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.success,
      textTransform: 'uppercase',
    },
    contentDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    contentStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
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
      fontSize: 10,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    contentActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.text,
    },
    actionButtonTextPrimary: {
      color: 'white',
    },

    // Edit Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalContent: {
      flex: 1,
    },
    formSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    formField: {
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 6,
    },
    fieldInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    switchField: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switchLabel: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    tag: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
    },
    tagText: {
      fontSize: 12,
      color: theme.colors.primary,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    modalButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextSecondary: {
      color: theme.colors.text,
    },
    modalButtonTextPrimary: {
      color: 'white',
    },
  });

  useEffect(() => {
    loadPublishedContent();
  }, []);

  const loadPublishedContent = useCallback(async () => {
    // Mock loading published content
    const mockContent: PublishedContent[] = state.uploadHistory
      .filter(item => item.status === 'completed')
      .map(item => ({
        ...item,
        views: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        downloads: Math.floor(Math.random() * 500),
        revenue: Math.floor(Math.random() * 1000) / 100,
        isPublished: Math.random() > 0.3,
        publishDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));
    
    setPublishedContent(mockContent);
  }, [state.uploadHistory]);

  const filteredContent = publishedContent.filter(item => {
    // Status filter
    if (filterStatus === 'published' && !item.isPublished) return false;
    if (filterStatus === 'draft' && item.isPublished) return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        item.metadata.title.toLowerCase().includes(query) ||
        item.metadata.description?.toLowerCase().includes(query) ||
        item.metadata.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        false
      );
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return b.views - a.views;
      case 'revenue':
        return b.revenue - a.revenue;
      case 'date':
      default:
        return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    }
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPublishedContent();
    } finally {
      setRefreshing(false);
    }
  }, [loadPublishedContent]);

  const handleEditContent = useCallback((item: PublishedContent) => {
    setEditingContent(item);
  }, []);

  const handleSaveContent = useCallback(async () => {
    if (!editingContent) return;

    try {
      await updateContentMetadata(editingContent.uploadId, editingContent.metadata);
      
      // Update local state
      setPublishedContent(prev =>
        prev.map(item =>
          item.uploadId === editingContent.uploadId
            ? { ...item, ...editingContent }
            : item
        )
      );

      setEditingContent(null);
      Alert.alert('Success', 'Content updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update content. Please try again.');
    }
  }, [editingContent, updateContentMetadata]);

  const handleTogglePublish = useCallback((item: PublishedContent) => {
    const action = item.isPublished ? 'unpublish' : 'publish';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Content`,
      `Are you sure you want to ${action} "${item.metadata.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: () => {
            setPublishedContent(prev =>
              prev.map(content =>
                content.uploadId === item.uploadId
                  ? { ...content, isPublished: !content.isPublished }
                  : content
              )
            );
          },
        },
      ]
    );
  }, []);

  const handleDeleteContent = useCallback((item: PublishedContent) => {
    Alert.alert(
      'Delete Content',
      `Are you sure you want to permanently delete "${item.metadata.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPublishedContent(prev =>
              prev.filter(content => content.uploadId !== item.uploadId)
            );
          },
        },
      ]
    );
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const renderContentItem = ({ item }: { item: PublishedContent }) => {
    return (
      <View style={styles.contentItem}>
        {item.thumbnailUrl && (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={styles.contentImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.contentInfo}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle} numberOfLines={2}>
              {item.metadata.title}
            </Text>
            <View style={[
              styles.publishStatus,
              {
                backgroundColor: item.isPublished
                  ? theme.colors.success + '20'
                  : theme.colors.warning + '20'
              }
            ]}>
              <Text style={[
                styles.publishStatusText,
                {
                  color: item.isPublished
                    ? theme.colors.success
                    : theme.colors.warning
                }
              ]}>
                {item.isPublished ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>

          {item.metadata.description && (
            <Text style={styles.contentDescription} numberOfLines={2}>
              {item.metadata.description}
            </Text>
          )}

          <View style={styles.contentStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(item.views)}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(item.likes)}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(item.downloads)}</Text>
              <Text style={styles.statLabel}>Downloads</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(item.revenue)}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          </View>

          <View style={styles.contentActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditContent(item)}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => handleTogglePublish(item)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                {item.isPublished ? 'Unpublish' : 'Publish'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteContent(item)}
            >
              <Text style={[styles.actionButtonText, { color: theme.colors.error }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEditModal = () => {
    if (!editingContent) return null;

    return (
      <Modal
        visible={!!editingContent}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingContent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Content</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditingContent(null)}
              >
                <Text style={{ fontSize: 18, color: theme.colors.text }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Title *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editingContent.metadata.title}
                    onChangeText={(text) => setEditingContent(prev => prev ? {
                      ...prev,
                      metadata: { ...prev.metadata, title: text }
                    } : null)}
                    placeholder="Enter content title"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.textArea]}
                    value={editingContent.metadata.description || ''}
                    onChangeText={(text) => setEditingContent(prev => prev ? {
                      ...prev,
                      metadata: { ...prev.metadata, description: text }
                    } : null)}
                    placeholder="Enter content description"
                    multiline
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editingContent.metadata.category}
                    onChangeText={(text) => setEditingContent(prev => prev ? {
                      ...prev,
                      metadata: { ...prev.metadata, category: text }
                    } : null)}
                    placeholder="Enter category"
                  />
                </View>

                {editingContent.metadata.tags && editingContent.metadata.tags.length > 0 && (
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Tags</Text>
                    <View style={styles.tagsContainer}>
                      {editingContent.metadata.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Pricing & Availability</Text>
                
                <View style={styles.switchField}>
                  <Text style={styles.switchLabel}>Published</Text>
                  <Switch
                    value={editingContent.isPublished}
                    onValueChange={(value) => setEditingContent(prev => prev ? {
                      ...prev,
                      isPublished: value
                    } : null)}
                    trackColor={{
                      false: theme.colors.border,
                      true: theme.colors.primary + '80',
                    }}
                    thumbColor={editingContent.isPublished ? theme.colors.primary : theme.colors.textSecondary}
                  />
                </View>

                {editingContent.metadata.pricing && (
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Price ($)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editingContent.metadata.pricing.amount?.toString() || ''}
                      onChangeText={(text) => setEditingContent(prev => prev ? {
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          pricing: {
                            ...prev.metadata.pricing!,
                            amount: parseFloat(text) || 0
                          }
                        }
                      } : null)}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setEditingContent(null)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveContent}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Save Changes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Content Management</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Upload' as never)}
          >
            <Text style={styles.headerButtonText}>+ Upload New</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search content..."
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        <View style={styles.filtersContainer}>
          {(['all', 'published', 'draft'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                filterStatus === filter && styles.filterChipActive,
              ]}
              onPress={() => setFilterStatus(filter)}
            >
              <Text style={[
                styles.filterChipText,
                filterStatus === filter && styles.filterChipTextActive,
              ]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          
          {(['date', 'views', 'revenue'] as const).map((sort) => (
            <TouchableOpacity
              key={sort}
              style={[
                styles.filterChip,
                sortBy === sort && styles.filterChipActive,
              ]}
              onPress={() => setSortBy(sort)}
            >
              <Text style={[
                styles.filterChipText,
                sortBy === sort && styles.filterChipTextActive,
              ]}>
                By {sort}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {filteredContent.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No Published Content"
            description="Your published content will appear here. Upload and publish content to get started."
          />
        ) : (
          <FlatList
            data={filteredContent}
            renderItem={renderContentItem}
            keyExtractor={(item) => item.uploadId}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
              />
            }
          />
        )}
      </View>

      {renderEditModal()}
    </SafeAreaView>
  );
};

export default ContentManagementScreen;