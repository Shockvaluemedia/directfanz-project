import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageType, MediaMetadata } from '../../types/messaging';
import { useTheme } from '../../hooks/useTheme';
import { formatFileSize, formatDuration } from '../../utils/formatUtils';

interface MediaPreviewProps {
  mediaUrl: string;
  mediaType: MessageType;
  mediaThumbnail?: string;
  metadata?: MediaMetadata;
  onPress?: () => void;
  style?: any;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({
  mediaUrl,
  mediaType,
  mediaThumbnail,
  metadata,
  onPress,
  style,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const renderImagePreview = () => (
    <TouchableOpacity 
      style={[styles.mediaContainer, styles.imageContainer, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: mediaThumbnail || mediaUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.imageOverlay}>
        <Ionicons name="expand-outline" size={20} color="white" />
      </View>
    </TouchableOpacity>
  );

  const renderVideoPreview = () => (
    <TouchableOpacity 
      style={[styles.mediaContainer, styles.videoContainer, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: mediaThumbnail || mediaUrl }}
        style={styles.video}
        resizeMode="cover"
      />
      <View style={styles.videoOverlay}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={24} color="white" />
        </View>
        {metadata?.duration && (
          <Text style={styles.videoDuration}>
            {formatDuration(metadata.duration)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAudioPreview = () => (
    <TouchableOpacity 
      style={[styles.mediaContainer, styles.audioContainer, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.audioContent}>
        <View style={styles.audioIcon}>
          <Ionicons name="musical-notes" size={24} color={colors.primary} />
        </View>
        <View style={styles.audioInfo}>
          <Text style={styles.audioTitle} numberOfLines={1}>
            {metadata?.fileName || 'Audio Message'}
          </Text>
          <Text style={styles.audioMetadata}>
            {metadata?.duration && formatDuration(metadata.duration)}
            {metadata?.fileSize && ` • ${formatFileSize(metadata.fileSize)}`}
          </Text>
        </View>
        <View style={styles.audioPlayButton}>
          <Ionicons name="play" size={20} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilePreview = () => {
    const getFileIcon = () => {
      const extension = metadata?.fileName?.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'pdf':
          return 'document-text';
        case 'doc':
        case 'docx':
          return 'document';
        case 'xls':
        case 'xlsx':
          return 'grid';
        case 'zip':
        case 'rar':
          return 'archive';
        default:
          return 'document-outline';
      }
    };

    return (
      <TouchableOpacity 
        style={[styles.mediaContainer, styles.fileContainer, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.fileContent}>
          <View style={styles.fileIcon}>
            <Ionicons name={getFileIcon()} size={24} color={colors.primary} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {metadata?.fileName || 'File'}
            </Text>
            <Text style={styles.fileMetadata}>
              {metadata?.fileSize && formatFileSize(metadata.fileSize)}
            </Text>
          </View>
          <View style={styles.downloadIcon}>
            <Ionicons name="download" size={20} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  switch (mediaType) {
    case 'IMAGE':
      return renderImagePreview();
    case 'VIDEO':
      return renderVideoPreview();
    case 'AUDIO':
      return renderAudioPreview();
    case 'FILE':
      return renderFilePreview();
    default:
      return null;
  }
};

const createStyles = (colors: any) => StyleSheet.create({
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
  },
  
  // Image styles
  imageContainer: {
    backgroundColor: colors.surfaceVariant,
    minHeight: 150,
    maxHeight: 250,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    minHeight: 150,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  
  // Video styles
  videoContainer: {
    backgroundColor: colors.surfaceVariant,
    minHeight: 150,
    maxHeight: 250,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    minHeight: 150,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    padding: 12,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  // Audio styles
  audioContainer: {
    backgroundColor: colors.surfaceVariant,
    minHeight: 60,
  },
  audioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  audioIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  audioMetadata: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // File styles
  fileContainer: {
    backgroundColor: colors.surfaceVariant,
    minHeight: 60,
  },
  fileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  fileMetadata: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  downloadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MediaPreview;