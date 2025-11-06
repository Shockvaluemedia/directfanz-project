import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../../hooks/useTheme';
import { MediaAttachment, SUPPORTED_MEDIA_TYPES } from '../../types/messaging';

interface MediaAttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (attachment: MediaAttachment) => void;
  allowedTypes?: Array<'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'>;
  maxFileSize?: number;
}

interface MediaOption {
  id: string;
  title: string;
  icon: string;
  description: string;
  color: string;
  onPress: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const MediaAttachmentPicker: React.FC<MediaAttachmentPickerProps> = ({
  visible,
  onClose,
  onMediaSelected,
  allowedTypes = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Request permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera access is needed to take photos and videos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library access is needed to select media.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestAudioPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Microphone access is needed to record audio messages.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Create media attachment object
  const createMediaAttachment = (
    uri: string,
    name: string,
    type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE',
    size: number,
    mimeType: string,
    duration?: number
  ): MediaAttachment => {
    return {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      uri,
      name,
      size,
      mimeType,
      duration,
      isUploading: false,
      uploadProgress: 0,
    };
  };

  // Media selection handlers
  const handleTakePhoto = async () => {
    if (!allowedTypes.includes('IMAGE')) return;
    
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > maxFileSize) {
          Alert.alert('File Too Large', `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`);
          return;
        }

        const attachment = createMediaAttachment(
          asset.uri,
          asset.fileName || 'photo.jpg',
          'IMAGE',
          asset.fileSize || 0,
          'image/jpeg'
        );

        onMediaSelected(attachment);
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectFromGallery = async () => {
    if (!allowedTypes.includes('IMAGE') && !allowedTypes.includes('VIDEO')) return;
    
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const mediaTypes = [];
      if (allowedTypes.includes('IMAGE')) mediaTypes.push(ImagePicker.MediaTypeOptions.Images);
      if (allowedTypes.includes('VIDEO')) mediaTypes.push(ImagePicker.MediaTypeOptions.Videos);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypes.length > 1 
          ? ImagePicker.MediaTypeOptions.All 
          : mediaTypes[0] || ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        videoQuality: ImagePicker.VideoQuality.Medium,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > maxFileSize) {
          Alert.alert('File Too Large', `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`);
          return;
        }

        const type = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
        const attachment = createMediaAttachment(
          asset.uri,
          asset.fileName || (type === 'VIDEO' ? 'video.mp4' : 'image.jpg'),
          type,
          asset.fileSize || 0,
          asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          asset.duration
        );

        onMediaSelected(attachment);
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };

  const handleRecordVideo = async () => {
    if (!allowedTypes.includes('VIDEO')) return;
    
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoQuality: ImagePicker.VideoQuality.Medium,
        videoMaxDuration: 300, // 5 minutes
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > maxFileSize) {
          Alert.alert('File Too Large', `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`);
          return;
        }

        const attachment = createMediaAttachment(
          asset.uri,
          asset.fileName || 'video.mp4',
          'VIDEO',
          asset.fileSize || 0,
          'video/mp4',
          asset.duration
        );

        onMediaSelected(attachment);
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const handleRecordAudio = async () => {
    if (!allowedTypes.includes('AUDIO')) return;

    const hasPermission = await requestAudioPermission();
    if (!hasPermission) return;

    try {
      if (isRecording) {
        // Stop recording
        if (recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          
          if (uri) {
            // Get file info
            const fileInfo = await fetch(uri);
            const blob = await fileInfo.blob();
            
            const attachment = createMediaAttachment(
              uri,
              'audio_message.m4a',
              'AUDIO',
              blob.size,
              'audio/m4a'
            );

            onMediaSelected(attachment);
          }
          
          setRecording(null);
          setIsRecording(false);
          onClose();
        }
      } else {
        // Start recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await newRecording.startAsync();
        
        setRecording(newRecording);
        setIsRecording(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record audio. Please try again.');
      setIsRecording(false);
      setRecording(null);
    }
  };

  const handleSelectDocument = async () => {
    if (!allowedTypes.includes('FILE')) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.size && asset.size > maxFileSize) {
          Alert.alert('File Too Large', `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`);
          return;
        }

        const attachment = createMediaAttachment(
          asset.uri,
          asset.name,
          'FILE',
          asset.size || 0,
          asset.mimeType || 'application/octet-stream'
        );

        onMediaSelected(attachment);
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  // Create media options based on allowed types
  const getMediaOptions = (): MediaOption[] => {
    const options: MediaOption[] = [];

    if (allowedTypes.includes('IMAGE')) {
      options.push({
        id: 'camera',
        title: 'Take Photo',
        icon: 'camera',
        description: 'Capture a new photo',
        color: colors.success || '#4CAF50',
        onPress: handleTakePhoto,
      });

      options.push({
        id: 'gallery',
        title: 'Photo Library',
        icon: 'images',
        description: 'Choose from gallery',
        color: colors.info || '#2196F3',
        onPress: handleSelectFromGallery,
      });
    }

    if (allowedTypes.includes('VIDEO')) {
      options.push({
        id: 'video',
        title: 'Record Video',
        icon: 'videocam',
        description: 'Record a new video',
        color: colors.warning || '#FF9800',
        onPress: handleRecordVideo,
      });
    }

    if (allowedTypes.includes('AUDIO')) {
      options.push({
        id: 'audio',
        title: isRecording ? 'Stop Recording' : 'Record Audio',
        icon: isRecording ? 'stop' : 'mic',
        description: isRecording ? 'Tap to stop recording' : 'Record voice message',
        color: isRecording ? colors.error : colors.primary,
        onPress: handleRecordAudio,
      });
    }

    if (allowedTypes.includes('FILE')) {
      options.push({
        id: 'document',
        title: 'Document',
        icon: 'document-attach',
        description: 'Select a file',
        color: colors.textSecondary,
        onPress: handleSelectDocument,
      });
    }

    return options;
  };

  const mediaOptions = getMediaOptions();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Attach Media</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Recording indicator */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording audio message...</Text>
            </View>
          )}

          {/* Media options */}
          <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.optionsGrid}>
              {mediaOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionItem}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                    <Ionicons name={option.icon as any} size={32} color={option.color} />
                  </View>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* File size limit info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Maximum file size: {Math.round(maxFileSize / (1024 * 1024))}MB
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area bottom
    maxHeight: '70%',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  
  // Recording indicator
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.errorSurface || `${colors.error}20`,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '500',
  },
  
  // Options
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  optionsGrid: {
    paddingVertical: 20,
  },
  optionItem: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Info
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surfaceVariant,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 6,
  },
});

export default MediaAttachmentPicker;
