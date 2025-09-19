import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DiscoverStackParamList } from '../types/navigation';

// Placeholder screen
import DiscoverScreen from '../screens/main/DiscoverScreen';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

const DiscoverNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverMain" component={DiscoverScreen} />
    </Stack.Navigator>
  );
};

export default DiscoverNavigator;
