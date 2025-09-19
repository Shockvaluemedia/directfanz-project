import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { useTheme } from '../../contexts/ThemeContext';

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 20,
          }}
        >
          Forgot Password
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginBottom: 30,
          }}
        >
          Password recovery form will be implemented here
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 25,
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
