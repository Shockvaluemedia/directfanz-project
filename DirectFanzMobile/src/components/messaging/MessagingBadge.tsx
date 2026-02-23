import React from 'react';
import { View, Text } from 'react-native';
import { useMessaging } from '../../contexts/MessagingContext';
import { useTheme } from '../../contexts/ThemeContext';

interface MessagingBadgeProps {
  children: React.ReactNode;
}

const MessagingBadge: React.FC<MessagingBadgeProps> = ({ children }) => {
  const { theme } = useTheme();
  const { getUnreadCount } = useMessaging();
  
  const unreadCount = getUnreadCount();
  const shouldShowBadge = unreadCount > 0;

  return (
    <View style={{ position: 'relative' }}>
      {children}
      
      {shouldShowBadge && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -6,
            backgroundColor: theme.colors.error,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontSize: 12,
              fontWeight: '600',
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount.toString()}
          </Text>
        </View>
      )}
    </View>
  );
};

export default MessagingBadge;