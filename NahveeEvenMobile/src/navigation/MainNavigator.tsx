import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MainTabParamList } from '../types/navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// Import navigators
import HomeNavigator from './HomeNavigator';
import DiscoverNavigator from './DiscoverNavigator';
import UploadNavigator from './UploadNavigator';
import ProfileNavigator from './ProfileNavigator';
import AnalyticsNavigator from './AnalyticsNavigator';

// Mock icons - in a real app, you'd use react-native-vector-icons
const TabIcon = ({
  name,
  focused,
  color,
  size = 24,
}: {
  name: string;
  focused: boolean;
  color: string;
  size?: number;
}) => {
  const iconMap: Record<string, string> = {
    home: focused ? '⌂' : '⌂',
    discover: focused ? '🔍' : '🔍',
    upload: focused ? '+' : '+',
    profile: focused ? '👤' : '👤',
    analytics: focused ? '📊' : '📊',
  };

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 8,
        height: size + 8,
      }}
    >
      <Text
        style={{
          fontSize: size,
          color: focused ? color : `${color}80`,
          fontWeight: focused ? 'bold' : 'normal',
        }}
      >
        {iconMap[name] || '?'}
      </Text>
    </View>
  );
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon
            name={route.name.toLowerCase()}
            focused={focused}
            color={color}
            size={size}
          />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 5,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
        }}
      />

      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{
          tabBarLabel: 'Discover',
        }}
      />

      <Tab.Screen
        name="Upload"
        component={UploadNavigator}
        options={{
          tabBarLabel: 'Create',
          tabBarButton: props => (
            <TouchableOpacity
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={props?.onPress}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -20,
                  shadowColor: theme.colors.primary,
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <TabIcon name="upload" focused={true} color="white" size={28} />
              </LinearGradient>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.primary,
                  fontWeight: '500',
                  marginTop: 4,
                }}
              >
                Create
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {user?.role === 'ARTIST' && (
        <Tab.Screen
          name="Analytics"
          component={AnalyticsNavigator}
          options={{
            tabBarLabel: 'Analytics',
          }}
        />
      )}

      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
