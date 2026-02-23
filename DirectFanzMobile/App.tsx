import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import screens
import SplashScreen from './src/screens/SplashScreen';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import ContentPlayerScreen from './src/screens/player/ContentPlayerScreen';
import ContentPreviewModal from './src/components/discovery/ContentPreviewModal';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { DiscoveryProvider } from './src/contexts/DiscoveryContext';

// Import types
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
        
        {/* Modal Screens */}
        <Stack.Screen
          name="Player"
          component={ContentPlayerScreen}
          options={{
            presentation: 'modal',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
        
        <Stack.Screen
          name="ContentPreview"
          component={ContentPreviewModal}
          options={{
            presentation: 'transparentModal',
            gestureEnabled: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>
              <DiscoveryProvider>
                <PlayerProvider>
                  <StatusBar
                    barStyle={
                      Platform.OS === 'ios' ? 'dark-content' : 'light-content'
                    }
                    backgroundColor="transparent"
                    translucent
                  />
                  <AppContent />
                </PlayerProvider>
              </DiscoveryProvider>
            </ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
