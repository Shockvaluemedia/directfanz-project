import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  description?: string; // Alternative to message
  actionText?: string;
  onActionPress?: () => void;
  onAction?: () => void; // Alternative to onActionPress
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  description,
  actionText,
  onActionPress,
  onAction,
}) => {
  const { theme, colors } = useTheme();
  const styles = createStyles(colors);

  const displayMessage = description || message;
  const handleAction = onAction || onActionPress;

  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={64} color={colors.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {actionText && handleAction && (
        <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default EmptyState;