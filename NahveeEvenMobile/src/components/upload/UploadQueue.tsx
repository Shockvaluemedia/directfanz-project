import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import { UploadQueueItem } from '../../types/upload';
import UploadProgress from './UploadProgress';

interface UploadQueueProps {
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const UploadQueue: React.FC<UploadQueueProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { state, cancelUpload, retryUpload, clearQueue } = useUpload();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.large,
      borderTopRightRadius: theme.borderRadius.large,
      maxHeight: height * 0.8,
      minHeight: height * 0.4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    queueList: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    queueItem: {
      marginBottom: 12,
    },
    selectionMode: {
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    actions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
      borderWidth: 1,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    dangerButton: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: 'white',
    },
    secondaryButtonText: {
      color: theme.colors.text,
    },
    dangerButtonText: {
      color: 'white',
    },
    statistics: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 2,
    },
  });

  const activeUploads = Object.values(state.activeUploads);
  const totalItems = state.uploadQueue.length;
  const completedItems = activeUploads.filter(upload => upload.status === 'completed').length;
  const failedItems = activeUploads.filter(upload => upload.status === 'failed').length;
  const uploadingItems = activeUploads.filter(upload => upload.status === 'uploading' || upload.status === 'preparing').length;

  // Calculate total progress
  const totalProgress = totalItems > 0 
    ? activeUploads.reduce((sum, upload) => sum + upload.progress, 0) / totalItems 
    : 0;

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Upload Queue',
      'This will cancel all pending uploads and clear the queue. Are you sure?',
      [
        { text: 'Keep Queue', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            clearQueue();
            setSelectedItems([]);
          }
        },
      ]
    );
  }, [clearQueue]);

  const handleRetryFailed = useCallback(() => {
    const failedUploads = activeUploads.filter(upload => upload.status === 'failed');
    failedUploads.forEach(upload => {
      retryUpload(upload.uploadId);
    });
  }, [activeUploads, retryUpload]);

  const handleItemPress = useCallback((item: UploadQueueItem) => {
    // Toggle selection for batch operations
    setSelectedItems(prev => 
      prev.includes(item.id) 
        ? prev.filter(id => id !== item.id)
        : [...prev, item.id]
    );
  }, []);

  const handleCancel = useCallback((uploadId: string) => {
    cancelUpload(uploadId);
  }, [cancelUpload]);

  const handleRetry = useCallback((uploadId: string) => {
    retryUpload(uploadId);
  }, [retryUpload]);

  const renderQueueItem = useCallback(({ item }: { item: UploadQueueItem }) => {
    const isSelected = selectedItems.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.queueItem,
          isSelected && styles.selectionMode,
        ]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleItemPress(item)}
      >
        <UploadProgress
          progress={item.progress}
          onCancel={() => handleCancel(item.id)}
          onRetry={() => handleRetry(item.id)}
          compact={false}
          showDetails={true}
        />
      </TouchableOpacity>
    );
  }, [selectedItems, handleItemPress, handleCancel, handleRetry, styles.queueItem, styles.selectionMode]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📁</Text>
      <Text style={styles.emptyTitle}>No Uploads in Queue</Text>
      <Text style={styles.emptyDescription}>
        Your upload queue is empty. Start uploading content to see progress here.
      </Text>
    </View>
  );

  const renderStatistics = () => (
    <View style={styles.statistics}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalItems}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.primary }]}>{uploadingItems}</Text>
        <Text style={styles.statLabel}>Uploading</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.success }]}>{completedItems}</Text>
        <Text style={styles.statLabel}>Complete</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.error }]}>{failedItems}</Text>
        <Text style={styles.statLabel}>Failed</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalProgress.toFixed(0)}%</Text>
        <Text style={styles.statLabel}>Progress</Text>
      </View>
    </View>
  );

  const renderActions = () => {
    const hasFailedUploads = failedItems > 0;
    const hasUploads = totalItems > 0;

    return (
      <View style={styles.actions}>
        {hasFailedUploads && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleRetryFailed}
          >
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Retry Failed ({failedItems})
            </Text>
          </TouchableOpacity>
        )}
        
        {hasUploads && (
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearAll}
          >
            <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={onClose}
        >
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Close
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Upload Queue</Text>
              <Text style={styles.subtitle}>
                {totalItems === 0 
                  ? 'No active uploads' 
                  : `${totalItems} item${totalItems !== 1 ? 's' : ''} • ${uploadingItems} uploading`
                }
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {totalItems > 0 && renderStatistics()}

          <View style={styles.content}>
            {totalItems === 0 ? (
              renderEmpty()
            ) : (
              <FlatList
                data={state.uploadQueue}
                renderItem={renderQueueItem}
                keyExtractor={(item) => item.id}
                style={styles.queueList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>

          {renderActions()}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default UploadQueue;