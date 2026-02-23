import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AnalyticsStackParamList } from '../types/navigation';

// Placeholder screen
import AnalyticsScreen from '../screens/main/AnalyticsScreen';

const Stack = createNativeStackNavigator<AnalyticsStackParamList>();

const AnalyticsNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
    </Stack.Navigator>
  );
};

export default AnalyticsNavigator;
