import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagingStackParamList } from '../types/navigation';
import { useTheme } from '../hooks/useTheme';

// Import messaging screens
import ConversationListScreen from '../screens/messaging/ConversationListScreen';
import ChatScreen from '../screens/messaging/ChatScreen';

const Stack = createNativeStackNavigator<MessagingStackParamList>();

const MessagingNavigator: React.FC = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{
          headerShown: false, // ConversationListScreen handles its own header
        }}
      />
      
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params.participantName || 'Chat',
          headerBackTitleVisible: false,
          headerTitleAlign: 'left',
        })}
      />
      
      {/* Future screens for messaging features */}
      {/*
      <Stack.Screen
        name="NewConversation"
        component={NewConversationScreen}
        options={{
          title: 'New Message',
          presentation: 'modal',
        }}
      />
      
      <Stack.Screen
        name="ConversationSettings"
        component={ConversationSettingsScreen}
        options={{
          title: 'Conversation Settings',
        }}
      />
      
      <Stack.Screen
        name="MessageSearch"
        component={MessageSearchScreen}
        options={{
          title: 'Search Messages',
        }}
      />
      
      <Stack.Screen
        name="MediaGallery"
        component={MediaGalleryScreen}
        options={{
          title: 'Media',
          presentation: 'modal',
        }}
      />
      */}
    </Stack.Navigator>
  );
};

export default MessagingNavigator;