import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useTheme } from '../../contexts/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 80,
    },
    logoCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 30,
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    logoText: {
      fontSize: 56,
      fontWeight: 'bold',
      color: 'white',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 4,
    },
    appName: {
      fontSize: 36,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 15,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    tagline: {
      fontSize: 18,
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
      fontStyle: 'italic',
      marginBottom: 20,
    },
    description: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 60,
    },
    buttonsContainer: {
      width: '100%',
      alignItems: 'center',
    },
    primaryButton: {
      width: '100%',
      height: 56,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: 'rgba(0, 0, 0, 0.3)',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    primaryButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    secondaryButton: {
      width: '100%',
      height: 56,
      backgroundColor: 'transparent',
      borderRadius: 28,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: 'white',
    },
    bottomText: {
      position: 'absolute',
      bottom: 40,
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#d946ef']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView
          style={{ flex: 1, justifyContent: 'center', width: '100%' }}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>NE</Text>
            </View>
            <Text style={styles.appName}>Nahvee Even</Text>
            <Text style={styles.tagline}>Where Creativity Meets Community</Text>
            <Text style={styles.description}>
              Connect with artists, discover exclusive content, and support
              creators you love. Join a community that celebrates creativity and
              authentic expression.
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bottomText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

export default WelcomeScreen;
