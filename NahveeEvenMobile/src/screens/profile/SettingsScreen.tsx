import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileStackParamList } from '../../types/navigation';

type SettingsNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { profile, updatePreferences, isLoading } = useProfile();
  const { logout } = useAuth();
  const navigation = useNavigation<SettingsNavigationProp>();

  const [localPreferences, setLocalPreferences] = useState({
    pushNotifications: profile?.preferences?.notifications.pushNotifications ?? true,
    emailNotifications: profile?.preferences?.notifications.emailNotifications ?? true,
    autoPlayVideos: profile?.preferences?.app.autoPlayVideos ?? true,
    biometricAuth: profile?.preferences?.app.biometricAuth ?? false,
    twoFactorAuth: profile?.preferences?.app.twoFactorAuth ?? false,
    showOnlineStatus: profile?.preferences?.privacy.showOnlineStatus ?? true,
    allowDirectMessages: profile?.preferences?.privacy.allowDirectMessages ?? 'SUBSCRIBERS_ONLY',
  });

  const handleTogglePreference = async (key: string, value: boolean) => {
    setLocalPreferences(prev => ({ ...prev, [key]: value }));

    try {
      const preferenceUpdate: any = {};
      
      if (['pushNotifications', 'emailNotifications'].includes(key)) {
        preferenceUpdate.notifications = {
          ...profile?.preferences?.notifications,
          [key]: value,
        };
      } else if (['autoPlayVideos', 'biometricAuth', 'twoFactorAuth'].includes(key)) {
        preferenceUpdate.app = {
          ...profile?.preferences?.app,
          [key]: value,
        };
      } else if (['showOnlineStatus', 'allowDirectMessages'].includes(key)) {
        preferenceUpdate.privacy = {
          ...profile?.preferences?.privacy,
          [key]: value,
        };
      }

      await updatePreferences(preferenceUpdate);
    } catch (error) {
      // Revert on error
      setLocalPreferences(prev => ({ ...prev, [key]: !value }));
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    headerButtonText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'center',
      marginRight: 40, // Balance the back button
    },
    scrollContent: {
      paddingBottom: 30,
    },
    section: {
      marginTop: 30,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    settingItemContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    settingAction: {
      marginLeft: 15,
    },
    arrow: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    actionButton: {
      backgroundColor: theme.colors.surface,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    logoutButton: {
      backgroundColor: theme.colors.error,
      marginTop: 10,
    },
    logoutButtonText: {
      color: 'white',
    },
    deleteButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.error,
      borderWidth: 2,
    },
    deleteButtonText: {
      color: theme.colors.error,
    },
    version: {
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 20,
      paddingHorizontal: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications on your device
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Switch
                value={localPreferences.pushNotifications}
                onValueChange={(value) => handleTogglePreference('pushNotifications', value)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={localPreferences.pushNotifications ? theme.colors.primary : theme.colors.textSecondary}
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Email Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive updates via email
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Switch
                value={localPreferences.emailNotifications}
                onValueChange={(value) => handleTogglePreference('emailNotifications', value)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={localPreferences.emailNotifications ? theme.colors.primary : theme.colors.textSecondary}
                disabled={isLoading}
              />
            </View>
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Show Online Status</Text>
              <Text style={styles.settingDescription}>
                Let others see when you're active
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Switch
                value={localPreferences.showOnlineStatus}
                onValueChange={(value) => handleTogglePreference('showOnlineStatus', value)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={localPreferences.showOnlineStatus ? theme.colors.primary : theme.colors.textSecondary}
                disabled={isLoading}
              />
            </View>
          </View>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Auto-play Videos</Text>
              <Text style={styles.settingDescription}>
                Automatically play videos in feeds
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Switch
                value={localPreferences.autoPlayVideos}
                onValueChange={(value) => handleTogglePreference('autoPlayVideos', value)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={localPreferences.autoPlayVideos ? theme.colors.primary : theme.colors.textSecondary}
                disabled={isLoading}
              />
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                Use fingerprint or face recognition to unlock
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Switch
                value={localPreferences.biometricAuth}
                onValueChange={(value) => handleTogglePreference('biometricAuth', value)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary + '80',
                }}
                thumbColor={localPreferences.biometricAuth ? theme.colors.primary : theme.colors.textSecondary}
                disabled={isLoading}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Change Password</Text>
              <Text style={styles.settingDescription}>
                Update your account password
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>Help Center</Text>
              <Text style={styles.settingDescription}>
                Find answers to common questions
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('About')}
          >
            <View style={styles.settingItemContent}>
              <Text style={styles.settingTitle}>About</Text>
              <Text style={styles.settingDescription}>
                App version and legal information
              </Text>
            </View>
            <View style={styles.settingAction}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>
          DirectFanz v1.0.0 (Beta)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;