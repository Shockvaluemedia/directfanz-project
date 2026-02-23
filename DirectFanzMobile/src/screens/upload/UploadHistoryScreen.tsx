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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import { 
  UploadHistoryItem, 
  UploadStatus, 
  ContentMetadata,
  UPLOAD_CONSTANTS,
} from '../../types/upload';

// Import common components
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const UploadHistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    state,
    loadUploadHistory,
    clearHistory,
    retryUpload,
    updateStatistics,
  } = useUpload();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<UploadStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UploadHistoryItem | null>(null);

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
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    filterButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.medium,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 60,
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    filterButtonTextActive: {
      color: 'white',
    },
    statisticsContainer: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statisticsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 4,
    },
    content: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    historyItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 12,
    },
    historyItemSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
      marginRight: 12,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      minWidth: 70,
      alignItems: 'center',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    itemDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    itemMeta: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    itemActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
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
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    actionButtonTextPrimary: {
      color: 'white',
    },
    selectionBar: {
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    selectionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    selectionActions: {
      flexDirection: 'row',
      gap: 12,
    },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.large,
      padding: 24,
      width: '90%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    modalSection: {
      marginBottom: 20,
    },
    modalSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    filterOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    filterOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      color: 'white',
    },
    modalButtonTextSecondary: {
      color: theme.colors.text,
    },
  });

  useEffect(() => {
    loadUploadHistory();
    updateStatistics();
  }, [loadUploadHistory, updateStatistics]);

  // Filter and search history
  const filteredHistory = state.uploadHistory.filter(item => {
    // Status filter
    if (filterStatus !== 'all' && item.status !== filterStatus) {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        item.metadata.title.toLowerCase().includes(query) ||
        item.mediaFile.name.toLowerCase().includes(query) ||
        item.metadata.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        false
      );
    }

    return true;
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUploadHistory();
      await updateStatistics();
    } finally {
      setRefreshing(false);
    }
  }, [loadUploadHistory, updateStatistics]);

  const handleItemPress = useCallback((item: UploadHistoryItem) => {
    if (selectedItems.length > 0) {
      // Toggle selection
      setSelectedItems(prev =>
        prev.includes(item.uploadId)
          ? prev.filter(id => id !== item.uploadId)
          : [...prev, item.uploadId]
      );
    } else {
      // Show item details
      Alert.alert(
        item.metadata.title,
        `Status: ${item.status}\nSize: ${formatFileSize(item.fileSize)}\nUploaded: ${new Date(item.uploadDate).toLocaleDateString()}`,
        [{ text: 'OK' }]
      );
    }
  }, [selectedItems]);

  const handleItemLongPress = useCallback((item: UploadHistoryItem) => {
    setSelectedItems([item.uploadId]);
  }, []);

  const handleRetryUpload = useCallback((item: UploadHistoryItem) => {
    Alert.alert(
      'Retry Upload',
      `Retry uploading "${item.metadata.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          onPress: () => {
            retryUpload(item.uploadId);
            // Navigate back to upload screen
            navigation.navigate('Upload' as never);
          },
        },
      ]
    );
  }, [retryUpload, navigation]);

  const handleDeleteItems = useCallback(() => {
    Alert.alert(
      'Delete Items',
      `Delete ${selectedItems.length} selected items from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete from history
            setSelectedItems([]);
          },
        },
      ]
    );
  }, [selectedItems]);

  const handleClearAllHistory = useCallback(() => {
    Alert.alert(
      'Clear All History',
      'This will permanently delete all upload history. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearHistory();
            setSelectedItems([]);
          },
        },
      ]
    );
  }, [clearHistory]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusConfig = (status: UploadStatus) => {
    const configs = {
      completed: {
        color: theme.colors.success,
        backgroundColor: theme.colors.success + '20',
        text: 'Complete',
      },
      failed: {
        color: theme.colors.error,
        backgroundColor: theme.colors.error + '20',
        text: 'Failed',
      },
      cancelled: {
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.textSecondary + '20',
        text: 'Cancelled',
      },
      pending: {
        color: theme.colors.warning,
        backgroundColor: theme.colors.warning + '20',
        text: 'Pending',
      },
      preparing: {
        color: theme.colors.info,
        backgroundColor: theme.colors.info + '20',
        text: 'Preparing',
      },
      uploading: {
        color: theme.colors.primary,
        backgroundColor: theme.colors.primary + '20',
        text: 'Uploading',
      },
      processing: {
        color: theme.colors.info,
        backgroundColor: theme.colors.info + '20',
        text: 'Processing',
      },
    };
    return configs[status];
  };

  const renderHistoryItem = ({ item }: { item: UploadHistoryItem }) => {
    const isSelected = selectedItems.includes(item.uploadId);
    const statusConfig = getStatusConfig(item.status);
    const canRetry = item.status === 'failed';

    return (
      <TouchableOpacity
        style={[styles.historyItem, isSelected && styles.historyItemSelected]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleItemLongPress(item)}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.metadata.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </View>
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.itemMeta}>
            {formatFileSize(item.fileSize)} • {new Date(item.uploadDate).toLocaleDateString()}
          </Text>
          <Text style={styles.itemMeta}>
            {item.metadata.category}
          </Text>
        </View>

        {item.error && (
          <Text style={[styles.itemMeta, { color: theme.colors.error, marginTop: 4 }]}>
            {item.error}
          </Text>
        )}

        {(canRetry || item.status === 'completed') && (
          <View style={styles.itemActions}>
            {canRetry && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => handleRetryUpload(item)}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
            
            {item.status === 'completed' && item.downloadUrl && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('View Content', `Open "${item.metadata.title}"?`);
                }}
              >
                <Text style={styles.actionButtonText}>View</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Filter & Sort</Text>
          
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Status</Text>
            {(['all', 'completed', 'failed', 'pending', 'uploading'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.filterOption}
                onPress={() => setFilterStatus(status)}
              >
                <Text style={styles.filterOptionText}>
                  {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  backgroundColor: filterStatus === status ? theme.colors.primary : 'transparent',
                }} />
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderStatistics = () => (
    <View style={styles.statisticsContainer}>
      <View style={styles.statisticsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{state.statistics.totalUploads}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {state.statistics.successfulUploads}
          </Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.error }]}>
            {state.statistics.failedUploads}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatFileSize(state.statistics.totalDataUploaded)}
          </Text>
          <Text style={styles.statLabel}>Data</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Upload History</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClearAllHistory}
          >
            <Text style={styles.headerButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search uploads..."
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus !== 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={[
              styles.filterButtonText,
              filterStatus !== 'all' && styles.filterButtonTextActive,
            ]}>
              {filterStatus === 'all' ? 'All' : filterStatus}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      {renderStatistics()}

      {/* Selection bar */}
      {selectedItems.length > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {selectedItems.length} selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleDeleteItems}>
              <Text style={[styles.headerButtonText, { color: theme.colors.error }]}>
                Delete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedItems([])}>
              <Text style={styles.headerButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {filteredHistory.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No Upload History"
            description="Your upload history will appear here once you start uploading content."
          />
        ) : (
          <FlatList
            data={filteredHistory}
            renderItem={renderHistoryItem}
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

      {renderFilterModal()}
    </SafeAreaView>
  );
};

export default UploadHistoryScreen;