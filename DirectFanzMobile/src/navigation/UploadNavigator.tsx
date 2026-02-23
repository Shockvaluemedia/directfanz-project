import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../types/navigation';

// Placeholder screen
import UploadScreen from '../screens/main/UploadScreen';

const Stack = createNativeStackNavigator<UploadStackParamList>();

const UploadNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UploadMain" component={UploadScreen} />
    </Stack.Navigator>
  );
};

export default UploadNavigator;
