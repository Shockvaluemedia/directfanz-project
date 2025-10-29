import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageStatus as MessageStatusType } from '../../types/messaging';
import { useTheme } from '../../hooks/useTheme';

interface MessageStatusProps {
  status: MessageStatusType;
  size?: number;
}

const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  size = 12,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getStatusIcon = () => {
    switch (status) {
      case 'SENDING':
        return (
          <Ionicons 
            name="time-outline" 
            size={size} 
            color={colors.textSecondary}
            style={styles.sendingIcon}
          />
        );
      
      case 'SENT':
        return (
          <Ionicons 
            name="checkmark" 
            size={size} 
            color={colors.textSecondary}
          />
        );
      
      case 'DELIVERED':
        return (
          <View style={styles.doubleCheck}>
            <Ionicons 
              name="checkmark" 
              size={size} 
              color={colors.textSecondary}
              style={styles.firstCheck}
            />
            <Ionicons 
              name="checkmark" 
              size={size} 
              color={colors.textSecondary}
              style={styles.secondCheck}
            />
          </View>
        );
      
      case 'READ':
        return (
          <View style={styles.doubleCheck}>
            <Ionicons 
              name="checkmark" 
              size={size} 
              color={colors.primary}
              style={styles.firstCheck}
            />
            <Ionicons 
              name="checkmark" 
              size={size} 
              color={colors.primary}
              style={styles.secondCheck}
            />
          </View>
        );
      
      case 'FAILED':
        return (
          <Ionicons 
            name="alert-circle" 
            size={size} 
            color={colors.error}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {getStatusIcon()}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 16,
  },
  sendingIcon: {
    opacity: 0.6,
  },
  doubleCheck: {
    flexDirection: 'row',
    position: 'relative',
    width: 16,
    justifyContent: 'center',
  },
  firstCheck: {
    position: 'absolute',
    left: 0,
  },
  secondCheck: {
    position: 'absolute',
    right: 0,
  },
});

export default MessageStatus;