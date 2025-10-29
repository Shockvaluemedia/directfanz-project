import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { UploadProgress as UploadProgressType, UploadStatus } from '../../types/upload';

interface UploadProgressProps {
  progress: UploadProgressType;
  onCancel?: () => void;
  onRetry?: () => void;
  onViewDetails?: () => void;
  compact?: boolean;
  showDetails?: boolean;
}

const { width } = Dimensions.get('window');

const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  onCancel,
  onRetry,
  onViewDetails,
  compact = false,
  showDetails = true,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      padding: compact ? 12 : 16,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: showDetails ? 8 : 0,
    },
    fileName: {
      flex: 1,
      fontSize: compact ? 14 : 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginRight: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.small,
      minWidth: 60,
      alignItems: 'center',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    progressContainer: {
      marginVertical: 8,
    },
    progressTrack: {
      height: compact ? 4 : 6,
      backgroundColor: theme.colors.border,
      borderRadius: compact ? 2 : 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: compact ? 2 : 3,
    },
    progressText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    details: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    detailItem: {
      flex: 1,
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.small,
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
    buttonText: {
      fontSize: 14,
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
    errorContainer: {
      backgroundColor: theme.colors.error + '10',
      borderRadius: theme.borderRadius.small,
      padding: 8,
      marginTop: 8,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      textAlign: 'center',
    },
  });

  // Status badge styling
  const statusConfig = useMemo(() => {
    const configs: Record<UploadStatus, { color: string; backgroundColor: string; text: string }> = {
      pending: {
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.border,
        text: 'Pending',
      },
      preparing: {
        color: theme.colors.warning,
        backgroundColor: theme.colors.warning + '20',
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
    };
    return configs[progress.status];
  }, [progress.status, theme]);

  // Progress gradient colors
  const progressColors = useMemo(() => {
    if (progress.status === 'failed') return [theme.colors.error, theme.colors.error];
    if (progress.status === 'completed') return [theme.colors.success, theme.colors.success];
    return theme.gradients.primary;
  }, [progress.status, theme]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format upload speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Upload',
      'Are you sure you want to cancel this upload?',
      [
        { text: 'Keep Uploading', style: 'cancel' },
        { 
          text: 'Cancel', 
          style: 'destructive',
          onPress: () => onCancel?.()
        },
      ]
    );
  };

  const canCancel = progress.status === 'pending' || progress.status === 'uploading' || progress.status === 'preparing';
  const canRetry = progress.status === 'failed' && progress.retryCount < progress.maxRetries;
  const showError = progress.status === 'failed' && progress.error;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.fileName} numberOfLines={1}>
          {progress.mediaFile.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.text}
          </Text>
        </View>
      </View>

      {showDetails && (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={progressColors}
                style={[styles.progressFill, { width: `${progress.progress}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.progress.toFixed(1)}% • {formatFileSize(progress.uploadedBytes)} of {formatFileSize(progress.totalBytes)}
            </Text>
          </View>

          <View style={styles.details}>
            {progress.uploadSpeed && progress.status === 'uploading' && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Speed</Text>
                <Text style={styles.detailValue}>{formatSpeed(progress.uploadSpeed)}</Text>
              </View>
            )}
            
            {progress.remainingTime && progress.status === 'uploading' && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Time Left</Text>
                <Text style={styles.detailValue}>{formatTimeRemaining(progress.remainingTime)}</Text>
              </View>
            )}

            {progress.retryCount > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Retries</Text>
                <Text style={styles.detailValue}>{progress.retryCount}/{progress.maxRetries}</Text>
              </View>
            )}

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Size</Text>
              <Text style={styles.detailValue}>{formatFileSize(progress.totalBytes)}</Text>
            </View>
          </View>

          {showError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{progress.error}</Text>
            </View>
          )}

          {(canCancel || canRetry || onViewDetails) && (
            <View style={styles.actions}>
              {canRetry && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={onRetry}
                >
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    Retry ({progress.maxRetries - progress.retryCount} left)
                  </Text>
                </TouchableOpacity>
              )}

              {onViewDetails && progress.status === 'completed' && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={onViewDetails}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              )}

              {canCancel && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={handleCancel}
                >
                  <Text style={[styles.buttonText, styles.dangerButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default UploadProgress;