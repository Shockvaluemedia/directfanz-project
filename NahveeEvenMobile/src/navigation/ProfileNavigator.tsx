import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../types/navigation';

// Import profile screens
import ProfileScreen from '../screens/main/ProfileScreen';
import ProfileEditScreen from '../screens/profile/ProfileEditScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

// Placeholder screens for future implementation
import { View, Text, SafeAreaView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => {
  const { theme } = useTheme();
  
  return (
    <SafeAreaView style={{ 
      flex: 1, 
      backgroundColor: theme.colors.background,
      justifyContent: 'center', 
      alignItems: 'center',
      padding: 20
    }}>
      <Text style={{ 
        fontSize: 24, 
        fontWeight: 'bold', 
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 10
      }}>
        {title}
      </Text>
      <Text style={{ 
        fontSize: 16, 
        color: theme.colors.textSecondary,
        textAlign: 'center' 
      }}>
        This feature will be implemented soon!
      </Text>
    </SafeAreaView>
  );
};

const SubscriptionsScreen = () => <PlaceholderScreen title="Subscriptions" />;
const PurchasesScreen = () => <PlaceholderScreen title="Purchases" />;
const HelpScreen = () => <PlaceholderScreen title="Help Center" />;
const AboutScreen = () => <PlaceholderScreen title="About" />;

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={ProfileEditScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="Purchases" component={PurchasesScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
