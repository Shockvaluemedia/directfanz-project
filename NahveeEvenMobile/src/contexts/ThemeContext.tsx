import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export interface Theme {
  name: 'light' | 'dark';
  colors: {
    primary: string;
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
  };
  gradients: {
    primary: string[];
    secondary: string[];
    background: string[];
  };
}

const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6',
  },
  gradients: {
    primary: ['#6366f1', '#8b5cf6'],
    secondary: ['#8b5cf6', '#d946ef'],
    background: ['#ffffff', '#f8fafc'],
  },
};

const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#818cf8',
    secondary: '#a78bfa',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    border: '#374151',
    error: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#60a5fa',
  },
  gradients: {
    primary: ['#818cf8', '#a78bfa'],
    secondary: ['#a78bfa', '#f472b6'],
    background: ['#111827', '#1f2937'],
  },
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  themeMode: 'light' | 'dark' | 'auto';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const THEME_STORAGE_KEY = '@nahvee_even_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('auto');
  const [currentTheme, setCurrentTheme] = useState<Theme>(
    systemColorScheme === 'dark' ? darkTheme : lightTheme,
  );

  // Load stored theme preference on app start
  useEffect(() => {
    loadStoredTheme();
  }, []);

  // Update theme when system theme or mode changes
  useEffect(() => {
    updateCurrentTheme();
  }, [themeMode, systemColorScheme]);

  const loadStoredTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme) {
        const parsedTheme = JSON.parse(storedTheme) as
          | 'light'
          | 'dark'
          | 'auto';
        setThemeMode(parsedTheme);
      }
    } catch (error) {
      console.error('Error loading stored theme:', error);
    }
  };

  const updateCurrentTheme = () => {
    let newTheme: Theme;

    if (themeMode === 'auto') {
      newTheme = systemColorScheme === 'dark' ? darkTheme : lightTheme;
    } else {
      newTheme = themeMode === 'dark' ? darkTheme : lightTheme;
    }

    setCurrentTheme(newTheme);
  };

  const setTheme = async (theme: 'light' | 'dark' | 'auto') => {
    setThemeMode(theme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch (error) {
      console.error('Error storing theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = currentTheme.name === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const value: ThemeContextType = {
    theme: currentTheme,
    isDark: currentTheme.name === 'dark',
    toggleTheme,
    setTheme,
    themeMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
