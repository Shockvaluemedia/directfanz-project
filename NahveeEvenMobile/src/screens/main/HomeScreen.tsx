import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import LinearGradient from 'react-native-linear-gradient';

const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 15,
    },
    greeting: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    cardDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    gradientCard: {
      borderRadius: 12,
      padding: 20,
      marginBottom: 15,
    },
    gradientText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    gradientSubtext: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 14,
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {user?.name?.split(' ')[0] || 'there'}! 👋
        </Text>
        <Text style={styles.subtitle}>Welcome to your creative space</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.gradientCard}
          >
            <Text style={styles.gradientText}>Start Creating Today</Text>
            <Text style={styles.gradientSubtext}>
              Share your creativity with the world. Upload your first content
              and connect with your audience.
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome to Nahvee Even!</Text>
            <Text style={styles.cardDescription}>
              You've successfully joined our creative community. Start by
              exploring content from other creators or upload your own work.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Complete Your Profile</Text>
            <Text style={styles.cardDescription}>
              Add a profile picture and bio to help others discover your work
              and connect with you.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trending Content</Text>
            <Text style={styles.cardDescription}>
              Check out what's popular in the community right now.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>New Artists</Text>
            <Text style={styles.cardDescription}>
              Discover emerging talent and be the first to support new creators.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Role: {user?.role}</Text>
            <Text style={styles.cardDescription}>Email: {user?.email}</Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => logout()}
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;
