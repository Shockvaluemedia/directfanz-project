import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import { MediaFile } from '../../types/upload';

// Import upload components
import MediaSelector from '../../components/upload/MediaSelector';
import ContentMetadataForm from '../../components/upload/ContentMetadataForm';
import UploadProgress from '../../components/upload/UploadProgress';
import UploadQueue from '../../components/upload/UploadQueue';

// Import upload service
import UploadService from '../../services/UploadService';

const UploadScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    state,
    setMediaFile,
    clearMediaFile,
    setUploadStep,
    startUpload,
    dispatch,
    canStartNewUpload,
    getTotalQueueSize,
  } = useUpload();

  const [showUploadQueue, setShowUploadQueue] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    headerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    queueIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.medium,
    },
    queueText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      marginLeft: 6,
    },
    content: {
      flex: 1,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
      marginHorizontal: 6,
    },
    stepDotActive: {
      backgroundColor: theme.colors.primary,
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    stepDotCompleted: {
      backgroundColor: theme.colors.success,
    },
    completionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    completionIcon: {
      fontSize: 64,
      marginBottom: 20,
    },
    completionTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    completionDescription: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    completionActions: {
      width: '100%',
      gap: 12,
    },
    completionButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: theme.borderRadius.medium,
      alignItems: 'center',
    },
    completionButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    completionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
    completionButtonTextSecondary: {
      color: theme.colors.text,
    },
    uploadingContainer: {
      flex: 1,
      padding: 20,
    },
    uploadingTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    uploadingSubtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
  });

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, [state.currentUpload.step]);

  // Handle media selection
  const handleMediaSelected = useCallback((mediaFile: MediaFile) => {
    // Validate file
    const validation = UploadService.validateFile(mediaFile);
    if (!validation.isValid) {
      Alert.alert(
        'Invalid File',
        validation.errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    setMediaFile(mediaFile);
  }, [setMediaFile]);

  // Handle media selection error
  const handleMediaError = useCallback((error: string) => {
    Alert.alert('Media Selection Error', error, [{ text: 'OK' }]);
  }, []);

  // Navigate to next step
  const handleNext = useCallback(() => {
    const currentStep = state.currentUpload.step;
    
    if (currentStep === 'details') {
      setUploadStep('preview');
    } else if (currentStep === 'preview') {
      handleStartUpload();
    }
  }, [state.currentUpload.step, setUploadStep]);

  // Navigate to previous step
  const handleBack = useCallback(() => {
    const currentStep = state.currentUpload.step;
    
    if (currentStep === 'details') {
      clearMediaFile();
      setUploadStep('select');
    } else if (currentStep === 'preview') {
      setUploadStep('details');
    } else if (currentStep === 'complete') {
      // Reset to start
      clearMediaFile();
      setUploadStep('select');
    } else if (currentStep === 'uploading') {
      // Ask for confirmation to cancel upload
      Alert.alert(
        'Cancel Upload?',
        'Are you sure you want to cancel this upload? Your progress will be lost.',
        [
          { text: 'Continue Uploading', style: 'cancel' },
          { 
            text: 'Cancel Upload', 
            style: 'destructive',
            onPress: () => {
              setUploadStep('preview');
              setIsUploading(false);
            }
          }
        ]
      );
    }
  }, [state.currentUpload.step, clearMediaFile, setUploadStep]);

  // Start upload process
  const handleStartUpload = useCallback(async () => {
    try {
      setIsUploading(true);
      await startUpload();
      
      // Simulate upload process
      const uploadId = Object.keys(state.activeUploads)[0];
      if (uploadId) {
        const uploadProgress = state.activeUploads[uploadId];
        
        // Start actual upload with service
        const session = await UploadService.startUpload(
          uploadId,
          uploadProgress.mediaFile,
          uploadProgress.metadata
        );
        
        if (session) {
          // Update progress as upload proceeds
          const success = await UploadService.uploadFile(
            uploadId,
            uploadProgress.mediaFile,
            (progress, uploadedBytes, speed) => {
              dispatch({
                type: 'UPDATE_UPLOAD_PROGRESS',
                payload: {
                  uploadId,
                  progress: {
                    progress,
                    uploadedBytes,
                    uploadSpeed: speed,
                    remainingTime: speed ? (uploadProgress.totalBytes - uploadedBytes) / speed : undefined,
                    status: 'uploading',
                  },
                },
              });
            }
          );
          
          if (success) {
            // Complete upload
            const result = await UploadService.completeUpload(
              uploadId,
              uploadProgress.mediaFile,
              uploadProgress.metadata
            );
            
            if (result) {
              dispatch({
                type: 'COMPLETE_UPLOAD',
                payload: { uploadId, contentId: result.contentId },
              });
              setUploadStep('complete');
            } else {
              throw new Error('Failed to complete upload');
            }
          } else {
            throw new Error('Upload failed');
          }
        } else {
          throw new Error('Failed to start upload session');
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        'There was an error uploading your content. Please try again.',
        [{ text: 'OK' }]
      );
      setUploadStep('preview');
    } finally {
      setIsUploading(false);
    }
  }, [startUpload, state.activeUploads, dispatch, setUploadStep]);

  // Handle new upload
  const handleNewUpload = useCallback(() => {
    clearMediaFile();
    setUploadStep('select');
  }, [clearMediaFile, setUploadStep]);

  // Get step indicator
  const getStepIndicator = () => {
    const steps = ['select', 'details', 'preview', 'uploading', 'complete'];
    const currentStepIndex = steps.indexOf(state.currentUpload.step);

    return (
      <View style={styles.stepIndicator}>
        {steps.slice(0, -1).map((step, index) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              index === currentStepIndex && styles.stepDotActive,
              index < currentStepIndex && styles.stepDotCompleted,
            ]}
          />
        ))}
      </View>
    );
  };

  // Render header
  const renderHeader = () => {
    const queueSize = getTotalQueueSize();
    
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {state.currentUpload.step === 'select' && 'Upload Content'}
          {state.currentUpload.step === 'details' && 'Content Details'}
          {state.currentUpload.step === 'preview' && 'Review & Upload'}
          {state.currentUpload.step === 'uploading' && 'Uploading...'}
          {state.currentUpload.step === 'complete' && 'Upload Complete'}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {queueSize > 0 && (
            <TouchableOpacity
              style={styles.queueIndicator}
              onPress={() => setShowUploadQueue(true)}
            >
              <Text>📁</Text>
              <Text style={styles.queueText}>{queueSize}</Text>
            </TouchableOpacity>
          )}
          
          {state.currentUpload.step !== 'select' && state.currentUpload.step !== 'complete' && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleBack}
            >
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render content based on current step
  const renderContent = () => {
    switch (state.currentUpload.step) {
      case 'select':
        return (
          <MediaSelector
            onMediaSelected={handleMediaSelected}
            onError={handleMediaError}
          />
        );

      case 'details':
        return (
          <ContentMetadataForm
            onNext={handleNext}
            onBack={handleBack}
            showNavigation={true}
          />
        );

      case 'preview':
        return (
          <PreviewScreen
            onUpload={handleStartUpload}
            onBack={handleBack}
          />
        );

      case 'uploading':
        const activeUploadId = Object.keys(state.activeUploads)[0];
        const uploadProgress = activeUploadId ? state.activeUploads[activeUploadId] : null;
        
        return (
          <View style={styles.uploadingContainer}>
            <Text style={styles.uploadingTitle}>Uploading Your Content</Text>
            <Text style={styles.uploadingSubtitle}>
              Please keep the app open while your content is being uploaded.
            </Text>
            
            {uploadProgress && (
              <UploadProgress
                progress={uploadProgress}
                compact={false}
                showDetails={true}
              />
            )}
          </View>
        );

      case 'complete':
        return (
          <View style={styles.completionContainer}>
            <Text style={styles.completionIcon}>🎉</Text>
            <Text style={styles.completionTitle}>Upload Complete!</Text>
            <Text style={styles.completionDescription}>
              Your content has been successfully uploaded and is now available to your audience.
            </Text>
            
            <View style={styles.completionActions}>
              <TouchableOpacity
                style={styles.completionButton}
                onPress={handleNewUpload}
              >
                <Text style={styles.completionButtonText}>Upload More Content</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.completionButton, styles.completionButtonSecondary]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.completionButtonText, styles.completionButtonTextSecondary]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {state.currentUpload.step !== 'complete' && getStepIndicator()}
      <View style={styles.content}>
        {renderContent()}
      </View>
      
      <UploadQueue
        visible={showUploadQueue}
        onClose={() => setShowUploadQueue(false)}
      />
    </SafeAreaView>
  );
};

// Preview screen component
const PreviewScreen: React.FC<{
  onUpload: () => void;
  onBack: () => void;
}> = ({ onUpload, onBack }) => {
  const { theme } = useTheme();
  const { state } = useUpload();
  const { mediaFile, metadata } = state.currentUpload;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 20,
    },
    previewCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.large,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    fileName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    fileSize: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    metadataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    metadataLabel: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    metadataValue: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
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
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: 'white',
    },
    secondaryButtonText: {
      color: theme.colors.text,
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Your Upload</Text>
      
      <View style={styles.previewCard}>
        <Text style={styles.fileName}>{mediaFile?.name}</Text>
        <Text style={styles.fileSize}>
          {mediaFile ? formatFileSize(mediaFile.size) : ''}
        </Text>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Title</Text>
          <Text style={styles.metadataValue}>{metadata.title}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Category</Text>
          <Text style={styles.metadataValue}>{metadata.category}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Visibility</Text>
          <Text style={styles.metadataValue}>{metadata.visibility}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Pricing</Text>
          <Text style={styles.metadataValue}>
            {metadata.pricingType === 'free' ? 'Free' : `$${metadata.price}`}
          </Text>
        </View>
        
        {metadata.tags && metadata.tags.length > 0 && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Tags</Text>
            <Text style={styles.metadataValue}>{metadata.tags.length} tags</Text>
          </View>
        )}
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onBack}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Edit Details
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onUpload}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Start Upload
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default UploadScreen;