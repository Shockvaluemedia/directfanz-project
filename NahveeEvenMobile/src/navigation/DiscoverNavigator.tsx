import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DiscoverStackParamList } from '../types/navigation';

// Import screens
import SearchScreen from '../screens/discovery/SearchScreen';
import CategoriesScreen from '../screens/discovery/CategoriesScreen';
import CategoryDetailScreen from '../screens/discovery/CategoryDetailScreen';
import ContentDetailScreen from '../screens/discovery/ContentDetailScreen';
import CreatorProfileScreen from '../screens/discovery/CreatorProfileScreen';
import TrendingScreen from '../screens/discovery/TrendingScreen';
import ContentFeedScreen from '../screens/discovery/ContentFeedScreen';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

const DiscoverNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverMain" component={ContentFeedScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Category" component={CategoryDetailScreen} />
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} />
      <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
      <Stack.Screen name="ViewCreatorProfile" component={CreatorProfileScreen} />
    </Stack.Navigator>
  );
};

export default DiscoverNavigator;
