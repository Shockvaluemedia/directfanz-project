import { useColorScheme } from 'react-native';

export interface Theme {
  colors: {
    primary: string;
    onPrimary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    shadow: string;
    disabled: string;
  };
  borderRadius: {
    small: number;
    medium: number;
    large: number;
    xl: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  dark: boolean;
}

const lightTheme: Theme = {
  colors: {
    primary: '#007AFF',
    onPrimary: '#FFFFFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#6D6D70',
    border: '#C6C6C8',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    info: '#007AFF',
    shadow: '#000000',
    disabled: '#C6C6C8',
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    xl: 16,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  dark: false,
};

const darkTheme: Theme = {
  colors: {
    primary: '#0A84FF',
    onPrimary: '#FFFFFF',
    secondary: '#5E5CE6',
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    error: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    info: '#64D2FF',
    shadow: '#000000',
    disabled: '#48484A',
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    xl: 16,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  dark: true,
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  return {
    theme,
    colors: theme.colors,
    ...theme
  };
};

// For backward compatibility
export const useThemeColors = (): Theme['colors'] => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  return theme.colors;
};
