import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useUpload } from '../../contexts/UploadContext';
import { MediaType, CaptureOptions, GallerySelectionOptions, FilePickerOptions } from '../../types/upload';

// Mock imports for now - these would be actual libraries in a real app
// import * as ImagePicker from 'expo-image-picker';
// import * as DocumentPicker from 'expo-document-picker';
// import { Audio } from 'expo-av';

interface MediaSelectorProps {
  onMediaSelected: (mediaFile: any) => void;
  onError: (error: string) => void;
}

const { width } = Dimensions.get('window');
const GRID_COLUMNS = 2;
const ITEM_SIZE = (width - 60) / GRID_COLUMNS;

const MediaSelector: React.FC<MediaSelectorProps> = ({ onMediaSelected, onError }) => {
  const { theme } = useTheme();
  const { state, dispatch } = useUpload();
  const [isCapturing, setIsCapturing] = useState(false);

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
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridItem: {
      width: ITEM_SIZE,
      height: ITEM_SIZE * 0.8,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      padding: 16,
    },
    gridItemActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}10`,
    },
    gridIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    gridTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    gridDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    permissionAlert: {
      backgroundColor: theme.colors.warning + '20',
      borderColor: theme.colors.warning,
      borderWidth: 1,
      borderRadius: theme.borderRadius.medium,
      padding: 16,
      marginBottom: 20,
    },
    permissionText: {
      color: theme.colors.warning,
      fontSize: 14,
      textAlign: 'center',
    },
    permissionButton: {
      backgroundColor: theme.colors.warning,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.small,
      marginTop: 8,
    },
    permissionButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    disabledItem: {
      opacity: 0.5,
    },
  });

  // Permission checking functions (mock implementations)
  const checkCameraPermission = useCallback(async () => {
    // Mock permission check - in real app would use expo-image-picker
    try {
      // const { status } = await ImagePicker.requestCameraPermissionsAsync();
      // dispatch({ type: 'SET_CAMERA_PERMISSION', payload: status === 'granted' ? 'granted' : 'denied' });
      // return status === 'granted';
      
      // Mock: assume granted for now
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: 'granted' });
      return true;
    } catch (error) {
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: 'denied' });
      return false;
    }
  }, [dispatch]);

  const checkMicrophonePermission = useCallback(async () => {
    // Mock permission check - in real app would use expo-av
    try {
      // const { status } = await Audio.requestPermissionsAsync();
      // dispatch({ type: 'SET_MICROPHONE_PERMISSION', payload: status === 'granted' ? 'granted' : 'denied' });
      // return status === 'granted';
      
      // Mock: assume granted for now
      dispatch({ type: 'SET_MICROPHONE_PERMISSION', payload: 'granted' });
      return true;
    } catch (error) {
      dispatch({ type: 'SET_MICROPHONE_PERMISSION', payload: 'denied' });
      return false;
    }
  }, [dispatch]);

  const checkStoragePermission = useCallback(async () => {
    // Mock permission check - in real app would use expo-media-library
    try {
      // const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // dispatch({ type: 'SET_STORAGE_PERMISSION', payload: status === 'granted' ? 'granted' : 'denied' });
      // return status === 'granted';
      
      // Mock: assume granted for now
      dispatch({ type: 'SET_STORAGE_PERMISSION', payload: 'granted' });
      return true;
    } catch (error) {
      dispatch({ type: 'SET_STORAGE_PERMISSION', payload: 'denied' });
      return false;
    }
  }, [dispatch]);

  // Media selection functions (mock implementations)
  const openCamera = useCallback(async (mediaType: 'image' | 'video') => {
    try {
      setIsCapturing(true);
      
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        onError('Camera permission denied');
        return;
      }

      // Mock camera capture - in real app would use expo-image-picker
      const options: CaptureOptions = {
        mediaType: mediaType === 'image' ? 'image' : 'video',
        quality: 'high',
        cameraType: 'back',
        includeLocation: false,
      };

      // const result = await ImagePicker.launchCameraAsync({
      //   mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      //   allowsEditing: true,
      //   aspect: [16, 9],
      //   quality: 0.8,
      //   videoMaxDuration: 60, // 1 minute max for videos
      // });

      // Mock result
      const mockResult = {
        cancelled: false,
        assets: [{
          uri: `mock://camera-${mediaType}-${Date.now()}`,
          fileName: `camera_${mediaType}_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`,
          fileSize: mediaType === 'image' ? 2048000 : 15360000, // 2MB for image, 15MB for video
          width: 1920,
          height: 1080,
          type: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
          duration: mediaType === 'video' ? 30000 : undefined, // 30 seconds for video
        }]
      };

      if (!mockResult.cancelled && mockResult.assets && mockResult.assets[0]) {
        const asset = mockResult.assets[0];
        const mediaFile = {
          uri: asset.uri,
          name: asset.fileName || `capture_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`,
          type: asset.type || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4'),
          size: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          mimeType: asset.type,
        };

        onMediaSelected(mediaFile);
      }
    } catch (error) {
      onError(`Failed to capture ${mediaType}: ${error}`);
    } finally {
      setIsCapturing(false);
    }
  }, [checkCameraPermission, onMediaSelected, onError]);

  const openGallery = useCallback(async (mediaType: 'image' | 'video' | 'any') => {
    try {
      const hasPermission = await checkStoragePermission();
      if (!hasPermission) {
        onError('Storage permission denied');
        return;
      }

      // Mock gallery selection - in real app would use expo-image-picker
      const options: GallerySelectionOptions = {
        mediaType,
        allowMultiple: false,
        includeImages: mediaType === 'image' || mediaType === 'any',
        includeVideos: mediaType === 'video' || mediaType === 'any',
        quality: 'high',
      };

      // const result = await ImagePicker.launchImageLibraryAsync({
      //   mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : 
      //               mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : 
      //               ImagePicker.MediaTypeOptions.All,
      //   allowsEditing: true,
      //   aspect: [16, 9],
      //   quality: 0.8,
      // });

      // Mock result
      const mockResult = {
        cancelled: false,
        assets: [{
          uri: `mock://gallery-${mediaType}-${Date.now()}`,
          fileName: `gallery_${mediaType}_${Date.now()}.${mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'jpg'}`,
          fileSize: mediaType === 'image' ? 3072000 : mediaType === 'video' ? 25600000 : 2048000, // Varying sizes
          width: 1920,
          height: 1080,
          type: mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          duration: mediaType === 'video' ? 45000 : undefined, // 45 seconds for video
        }]
      };

      if (!mockResult.cancelled && mockResult.assets && mockResult.assets[0]) {
        const asset = mockResult.assets[0];
        const mediaFile = {
          uri: asset.uri,
          name: asset.fileName || `gallery_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
          mimeType: asset.type,
        };

        onMediaSelected(mediaFile);
      }
    } catch (error) {
      onError(`Failed to select from gallery: ${error}`);
    }
  }, [checkStoragePermission, onMediaSelected, onError]);

  const recordAudio = useCallback(async () => {
    try {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        onError('Microphone permission denied');
        return;
      }

      // Mock audio recording - in real app would use expo-av
      Alert.alert(
        'Audio Recording',
        'Audio recording functionality will be implemented with expo-av',
        [
          {
            text: 'Mock Record',
            onPress: () => {
              // Mock audio file
              const mockAudioFile = {
                uri: `mock://audio-recording-${Date.now()}`,
                name: `recording_${Date.now()}.m4a`,
                type: 'audio/m4a',
                size: 1024000, // 1MB
                duration: 60, // 1 minute
                mimeType: 'audio/m4a',
              };
              onMediaSelected(mockAudioFile);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      onError(`Failed to record audio: ${error}`);
    }
  }, [checkMicrophonePermission, onMediaSelected, onError]);

  const pickDocument = useCallback(async () => {
    try {
      // Mock document picker - in real app would use expo-document-picker
      const options: FilePickerOptions = {
        allowedTypes: ['application/pdf', 'text/plain', 'application/msword'],
        allowMultiple: false,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        title: 'Select Document',
      };

      // const result = await DocumentPicker.getDocumentAsync({
      //   type: options.allowedTypes,
      //   multiple: options.allowMultiple,
      // });

      // Mock result
      Alert.alert(
        'Document Picker',
        'Document picker functionality will be implemented with expo-document-picker',
        [
          {
            text: 'Mock Select PDF',
            onPress: () => {
              const mockDocumentFile = {
                uri: `mock://document-${Date.now()}`,
                name: `document_${Date.now()}.pdf`,
                type: 'application/pdf',
                size: 5120000, // 5MB
                mimeType: 'application/pdf',
              };
              onMediaSelected(mockDocumentFile);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      onError(`Failed to pick document: ${error}`);
    }
  }, [onMediaSelected, onError]);

  const requestPermissions = useCallback(async () => {
    await Promise.all([
      checkCameraPermission(),
      checkMicrophonePermission(),
      checkStoragePermission(),
    ]);
  }, [checkCameraPermission, checkMicrophonePermission, checkStoragePermission]);

  // Media options data
  const mediaOptions = [
    {
      id: 'camera-photo',
      icon: '📷',
      title: 'Take Photo',
      description: 'Capture a photo with camera',
      onPress: () => openCamera('image'),
      disabled: state.cameraPermission === 'denied',
      permission: 'camera',
    },
    {
      id: 'camera-video',
      icon: '🎥',
      title: 'Record Video',
      description: 'Record a video with camera',
      onPress: () => openCamera('video'),
      disabled: state.cameraPermission === 'denied',
      permission: 'camera',
    },
    {
      id: 'gallery-photo',
      icon: '🖼️',
      title: 'Photo Gallery',
      description: 'Choose photo from gallery',
      onPress: () => openGallery('image'),
      disabled: state.storagePermission === 'denied',
      permission: 'storage',
    },
    {
      id: 'gallery-video',
      icon: '📹',
      title: 'Video Gallery',
      description: 'Choose video from gallery',
      onPress: () => openGallery('video'),
      disabled: state.storagePermission === 'denied',
      permission: 'storage',
    },
    {
      id: 'record-audio',
      icon: '🎙️',
      title: 'Record Audio',
      description: 'Record audio or music',
      onPress: recordAudio,
      disabled: state.microphonePermission === 'denied',
      permission: 'microphone',
    },
    {
      id: 'pick-document',
      icon: '📄',
      title: 'Documents',
      description: 'Upload PDF or text files',
      onPress: pickDocument,
      disabled: false,
      permission: 'none',
    },
  ];

  const hasPermissionIssues = 
    state.cameraPermission === 'denied' || 
    state.microphonePermission === 'denied' || 
    state.storagePermission === 'denied';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Media</Text>
        <Text style={styles.subtitle}>Choose how you'd like to add your content</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {hasPermissionIssues && (
          <View style={styles.permissionAlert}>
            <Text style={styles.permissionText}>
              Some features require permissions to work properly
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermissions}
            >
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.grid}>
          {mediaOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.gridItem,
                option.disabled && styles.disabledItem,
                isCapturing && styles.gridItemActive,
              ]}
              onPress={option.disabled ? undefined : option.onPress}
              disabled={option.disabled || isCapturing}
              activeOpacity={0.8}
            >
              <Text style={styles.gridIcon}>{option.icon}</Text>
              <Text style={styles.gridTitle}>{option.title}</Text>
              <Text style={styles.gridDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default MediaSelector;