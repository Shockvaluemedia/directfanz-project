import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useTheme } from '../../contexts/ThemeContext';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  editable?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const SIZES = {
  small: 40,
  medium: 60,
  large: 80,
  xlarge: 120,
};

const Avatar: React.FC<AvatarProps> = ({
  uri,
  name = '',
  size = 'medium',
  editable = false,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const avatarSize = SIZES[size];

  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const styles = StyleSheet.create({
    container: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
      ...style,
    },
    touchable: {
      width: '100%',
      height: '100%',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    initials: {
      color: 'white',
      fontSize: avatarSize * 0.35,
      fontWeight: '600',
    },
    editableOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: avatarSize * 0.3,
      height: avatarSize * 0.3,
      backgroundColor: theme.colors.primary,
      borderRadius: avatarSize * 0.15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    editIcon: {
      color: 'white',
      fontSize: avatarSize * 0.15,
      fontWeight: 'bold',
    },
  });

  const renderContent = () => {
    if (uri) {
      return (
        <FastImage
          source={{ uri }}
          style={styles.image}
          resizeMode={FastImage.resizeMode.cover}
        />
      );
    }

    return (
      <View style={styles.placeholder}>
        <Text style={styles.initials}>{getInitials(name)}</Text>
      </View>
    );
  };

  if (editable || onPress) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.touchable}
          onPress={onPress}
          activeOpacity={0.8}
        >
          {renderContent()}
        </TouchableOpacity>
        {editable && (
          <View style={styles.editableOverlay}>
            <Text style={styles.editIcon}>✏️</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderContent()}
    </View>
  );
};

export default Avatar;