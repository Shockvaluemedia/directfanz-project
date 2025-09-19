import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text
          style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.text }}
        >
          👤 Profile
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: theme.colors.textSecondary,
            marginTop: 10,
          }}
        >
          User profile and settings will be implemented here
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ProfileScreen;
