import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useMessagingNavigation } from '../../hooks/useMessagingNavigation';

interface MessageButtonProps {
  userId: string;
  userName?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onPress?: () => void;
  style?: any;
}

const MessageButton: React.FC<MessageButtonProps> = ({
  userId,
  userName,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const { navigateToNewConversation } = useMessagingNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigateToNewConversation(userId, userName);
    }
  };

  const getButtonStyle = () => {
    const baseStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
    };

    const sizeStyles = {
      small: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 32,
      },
      medium: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 40,
      },
      large: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        minHeight: 48,
      },
    };

    const variantStyles = {
      primary: {
        backgroundColor: disabled ? theme.colors.disabled : theme.colors.primary,
        borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
      },
      secondary: {
        backgroundColor: disabled ? theme.colors.disabled : theme.colors.surface,
        borderColor: disabled ? theme.colors.disabled : theme.colors.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: disabled ? theme.colors.disabled : theme.colors.primary,
      },
    };

    return [
      baseStyle,
      sizeStyles[size],
      variantStyles[variant],
      disabled && { opacity: 0.6 },
    ];
  };

  const getTextStyle = () => {
    const baseStyle = {
      fontWeight: '600' as const,
    };

    const sizeStyles = {
      small: {
        fontSize: 14,
      },
      medium: {
        fontSize: 16,
      },
      large: {
        fontSize: 18,
      },
    };

    const variantStyles = {
      primary: {
        color: disabled ? theme.colors.textSecondary : theme.colors.background,
      },
      secondary: {
        color: disabled ? theme.colors.textSecondary : theme.colors.text,
      },
      outline: {
        color: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
    };

    return [
      baseStyle,
      sizeStyles[size],
      variantStyles[variant],
    ];
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: size === 'small' ? 16 : 18, marginRight: 6 }}>
          💬
        </Text>
        <Text style={getTextStyle()}>
          Message
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Quick message button for compact layouts
export const CompactMessageButton: React.FC<{
  userId: string;
  userName?: string;
  onPress?: () => void;
  style?: any;
}> = ({ userId, userName, onPress, style }) => {
  const { theme } = useTheme();
  const { navigateToNewConversation } = useMessagingNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigateToNewConversation(userId, userName);
    }
  };

  return (
    <TouchableOpacity
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: 18, color: theme.colors.background }}>
        💬
      </Text>
    </TouchableOpacity>
  );
};

export default MessageButton;