import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  style?: any;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'small',
  color,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <ActivityIndicator
      size={size}
      color={color || colors.primary}
      style={[styles.spinner, style]}
    />
  );
};

const styles = StyleSheet.create({
  spinner: {
    // Add any default styles here
  },
});

export default LoadingSpinner;