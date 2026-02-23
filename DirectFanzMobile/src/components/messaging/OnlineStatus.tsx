import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface OnlineStatusProps {
  isOnline: boolean;
  size?: number;
  style?: any;
}

const OnlineStatus: React.FC<OnlineStatusProps> = ({
  isOnline,
  size = 12,
  style,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors, size);

  if (!isOnline) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.indicator} />
    </View>
  );
};

const createStyles = (colors: any, size: number) => StyleSheet.create({
  container: {
    width: size + 4,
    height: size + 4,
    borderRadius: (size + 4) / 2,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.success || '#4CAF50',
  },
});

export default OnlineStatus;