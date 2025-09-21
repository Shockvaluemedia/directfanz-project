import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../types/navigation';

// Import screens
import HomeScreen from '../screens/main/HomeScreen';
import ContentDetailScreen from '../screens/discovery/ContentDetailScreen';
import CreatorProfileScreen from '../screens/discovery/CreatorProfileScreen';
import SearchScreen from '../screens/discovery/SearchScreen';
import TrendingScreen from '../screens/discovery/TrendingScreen';
import CategoriesScreen from '../screens/discovery/CategoriesScreen';
import CategoryDetailScreen from '../screens/discovery/CategoryDetailScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} />
      <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Trending" component={TrendingScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
    </Stack.Navigator>
  );
};

export default HomeNavigator;
