import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { ProfileStackParamList } from '../../types/navigation';
import ProfileInfoCard from '../../components/profile/ProfileInfoCard';
import StatsCard from '../../components/profile/StatsCard';
import LinearGradient from 'react-native-linear-gradient';

type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { profile, isLoading, error, fetchProfile } = useProfile();
  const navigation = useNavigation<ProfileNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && !profile) {
      fetchProfile();
    }
  }, [user, profile, fetchProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleAvatarPress = () => {
    Alert.alert(
      'Update Profile Picture',
      'Choose an option to update your profile picture',
      [
        { text: 'Camera', onPress: () => console.log('Open camera') },
        { text: 'Gallery', onPress: () => console.log('Open gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    headerButton: {
      padding: 8,
    },
    headerButtonText: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    section: {
      marginVertical: 10,
    },
    quickActionsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickActionsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
      textAlign: 'center',
    },
    quickActionsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    quickActionItem: {
      alignItems: 'center',
      flex: 1,
      paddingVertical: 15,
    },
    quickActionIcon: {
      fontSize: 24,
      marginBottom: 8,
    },
    quickActionText: {
      fontSize: 12,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
    gradientCard: {
      borderRadius: 12,
      padding: 20,
      marginVertical: 10,
      alignItems: 'center',
    },
    gradientText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    gradientSubtext: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 14,
      textAlign: 'center',
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
    },
    logoutButton: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      alignSelf: 'center',
      marginTop: 20,
    },
    logoutText: {
      color: 'white',
      fontWeight: '600',
    },
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Please log in to view your profile</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Error loading profile: {error}</Text>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleRefresh}
        >
          <Text style={styles.logoutText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>⚙️</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Profile</Text>
        
        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading && !profile ? (
          <Text style={styles.loadingText}>Loading profile...</Text>
        ) : profile ? (
          <>
            {/* Profile Info */}
            <View style={styles.section}>
              <ProfileInfoCard
                profile={profile}
                onEditPress={handleEditProfile}
                onAvatarPress={handleAvatarPress}
                showEditButton={true}
              />
            </View>

            {/* Statistics */}
            <View style={styles.section}>
              <StatsCard stats={profile.stats} role={profile.role} />
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <View style={styles.quickActionsCard}>
                <Text style={styles.quickActionsTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => navigation.navigate('EditProfile')}
                  >
                    <Text style={styles.quickActionIcon}>✏️</Text>
                    <Text style={styles.quickActionText}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => navigation.navigate('Settings')}
                  >
                    <Text style={styles.quickActionIcon}>⚙️</Text>
                    <Text style={styles.quickActionText}>Settings</Text>
                  </TouchableOpacity>

                  {profile.role === 'ARTIST' && (
                    <TouchableOpacity
                      style={styles.quickActionItem}
                      onPress={() => navigation.navigate('Subscriptions')}
                    >
                      <Text style={styles.quickActionIcon}>👥</Text>
                      <Text style={styles.quickActionText}>Subscribers</Text>
                    </TouchableOpacity>
                  )}

                  {profile.role === 'FAN' && (
                    <TouchableOpacity
                      style={styles.quickActionItem}
                      onPress={() => navigation.navigate('Subscriptions')}
                    >
                      <Text style={styles.quickActionIcon}>⭐</Text>
                      <Text style={styles.quickActionText}>Subscriptions</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Role-specific CTA */}
            {profile.role === 'ARTIST' && (
              <View style={styles.section}>
                <LinearGradient
                  colors={theme.gradients.primary}
                  style={styles.gradientCard}
                >
                  <Text style={styles.gradientText}>Grow Your Audience</Text>
                  <Text style={styles.gradientSubtext}>
                    Share exclusive content and connect with your fans to build a
                    strong community around your art.
                  </Text>
                </LinearGradient>
              </View>
            )}

            {profile.role === 'FAN' && (
              <View style={styles.section}>
                <LinearGradient
                  colors={theme.gradients.secondary}
                  style={styles.gradientCard}
                >
                  <Text style={styles.gradientText}>Discover New Artists</Text>
                  <Text style={styles.gradientSubtext}>
                    Explore fresh talent and support your favorite creators by
                    subscribing to their exclusive content.
                  </Text>
                </LinearGradient>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.errorText}>No profile data available</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
