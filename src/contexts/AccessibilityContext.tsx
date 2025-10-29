'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface AccessibilitySettings {
  // Visual preferences
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  colorBlindFriendly: boolean;
  textSize: 'small' | 'medium' | 'large' | 'extra-large';
  
  // Interaction preferences
  keyboardNavigation: boolean;
  screenReaderMode: boolean;
  focusVisible: boolean;
  skipAnimations: boolean;
  
  // Audio/Video preferences
  autoPlayDisabled: boolean;
  captionsEnabled: boolean;
  audioDescriptionEnabled: boolean;
  transcriptPreferred: boolean;
  
  // Content preferences
  contentWarnings: boolean;
  descriptiveAltText: boolean;
  simplifiedInterface: boolean;
}

interface AccessibilityState {
  settings: AccessibilitySettings;
  isScreenReaderActive: boolean;
  currentFocusId: string | null;
  announcements: string[];
  keyboardShortcuts: Map<string, () => void>;
}

interface AccessibilityContextType extends AccessibilityState {
  // Settings management
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K, 
    value: AccessibilitySettings[K]
  ) => void;
  resetSettings: () => void;
  
  // Screen reader functions
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  clearAnnouncements: () => void;
  
  // Focus management
  setFocus: (elementId: string) => void;
  getFocusableElements: (container?: HTMLElement) => HTMLElement[];
  trapFocus: (container: HTMLElement) => () => void;
  
  // Keyboard navigation
  registerShortcut: (key: string, callback: () => void) => void;
  unregisterShortcut: (key: string) => void;
  
  // Utility functions
  getContrastRatio: (background: string, foreground: string) => number;
  isColorBlind: (type?: 'deuteranopia' | 'protanopia' | 'tritanopia') => boolean;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  colorBlindFriendly: false,
  textSize: 'medium',
  keyboardNavigation: true,
  screenReaderMode: false,
  focusVisible: true,
  skipAnimations: false,
  autoPlayDisabled: false,
  captionsEnabled: false,
  audioDescriptionEnabled: false,
  transcriptPreferred: false,
  contentWarnings: true,
  descriptiveAltText: true,
  simplifiedInterface: false
};

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const [currentFocusId, setCurrentFocusId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [keyboardShortcuts] = useState(new Map<string, () => void>());

  const liveRegionRef = useRef<HTMLDivElement>(null);
  const assertiveRegionRef = useRef<HTMLDivElement>(null);

  // Detect system preferences on mount
  useEffect(() => {
    const detectSystemPreferences = () => {
      const mediaQueries = {
        highContrast: '(prefers-contrast: high)',
        reducedMotion: '(prefers-reduced-motion: reduce)',
        largeText: '(min-resolution: 1.5dppx)', // Approximate large text detection
      };

      Object.entries(mediaQueries).forEach(([key, query]) => {
        const mediaQuery = window.matchMedia(query);
        if (mediaQuery.matches) {
          setSettings(prev => ({
            ...prev,
            [key]: true
          }));
        }
        
        // Listen for changes
        const handler = (e: MediaQueryListEvent) => {
          setSettings(prev => ({
            ...prev,
            [key]: e.matches
          }));
        };
        
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      });
    };

    detectSystemPreferences();

    // Detect screen reader
    const detectScreenReader = () => {
      // Check for common screen reader indicators
      const hasScreenReader = 
        window.navigator.userAgent.includes('NVDA') ||
        window.navigator.userAgent.includes('JAWS') ||
        window.navigator.userAgent.includes('VoiceOver') ||
        window.speechSynthesis?.getVoices().length > 0;

      setIsScreenReaderActive(hasScreenReader);
      
      if (hasScreenReader) {
        setSettings(prev => ({
          ...prev,
          screenReaderMode: true,
          descriptiveAltText: true,
          captionsEnabled: true
        }));
      }
    };

    detectScreenReader();

    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('directfanz-accessibility-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to load accessibility settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('directfanz-accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Apply CSS custom properties for accessibility
  useEffect(() => {
    const root = document.documentElement;
    
    // Text size
    const textSizeMap = {
      small: '0.875',
      medium: '1',
      large: '1.125',
      'extra-large': '1.25'
    };
    root.style.setProperty('--text-scale', textSizeMap[settings.textSize]);
    
    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    // Color blind friendly
    if (settings.colorBlindFriendly) {
      root.classList.add('colorblind-friendly');
    } else {
      root.classList.remove('colorblind-friendly');
    }

    // Focus visible
    if (settings.focusVisible) {
      root.classList.add('focus-visible');
    } else {
      root.classList.remove('focus-visible');
    }
  }, [settings]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!settings.keyboardNavigation) return;

      const key = `${event.ctrlKey ? 'ctrl+' : ''}${event.altKey ? 'alt+' : ''}${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`;
      
      const callback = keyboardShortcuts.get(key);
      if (callback) {
        event.preventDefault();
        callback();
      }

      // Default navigation shortcuts
      switch (key) {
        case 'alt+1':
          event.preventDefault();
          focusMainContent();
          break;
        case 'alt+2':
          event.preventDefault();
          focusNavigation();
          break;
        case 'alt+s':
          event.preventDefault();
          focusSearch();
          break;
        case '/':
          if (!isInputFocused()) {
            event.preventDefault();
            focusSearch();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcuts, settings.keyboardNavigation]);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K, 
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    localStorage.removeItem('directfanz-accessibility-settings');
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncements(prev => [...prev, message]);
    
    const region = priority === 'assertive' ? assertiveRegionRef.current : liveRegionRef.current;
    if (region) {
      region.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  }, []);

  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
  }, []);

  const setFocus = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      setCurrentFocusId(elementId);
    }
  }, []);

  const getFocusableElements = useCallback((container: HTMLElement = document.body): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  }, []);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [getFocusableElements]);

  const registerShortcut = useCallback((key: string, callback: () => void) => {
    keyboardShortcuts.set(key, callback);
  }, [keyboardShortcuts]);

  const unregisterShortcut = useCallback((key: string) => {
    keyboardShortcuts.delete(key);
  }, [keyboardShortcuts]);

  const getContrastRatio = useCallback((background: string, foreground: string): number => {
    const getRGB = (color: string) => {
      const div = document.createElement('div');
      div.style.color = color;
      document.body.appendChild(div);
      const rgb = window.getComputedStyle(div).color;
      document.body.removeChild(div);
      
      const match = rgb.match(/\d+/g);
      return match ? match.map(Number) : [0, 0, 0];
    };

    const getLuminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const bgRGB = getRGB(background);
    const fgRGB = getRGB(foreground);
    
    const bgLuminance = getLuminance(bgRGB);
    const fgLuminance = getLuminance(fgRGB);
    
    const lighter = Math.max(bgLuminance, fgLuminance);
    const darker = Math.min(bgLuminance, fgLuminance);
    
    return (lighter + 0.05) / (darker + 0.05);
  }, []);

  const isColorBlind = useCallback((type?: 'deuteranopia' | 'protanopia' | 'tritanopia'): boolean => {
    // This would typically use more sophisticated detection
    // For now, return the user's preference
    return settings.colorBlindFriendly;
  }, [settings.colorBlindFriendly]);

  // Helper functions
  const focusMainContent = () => {
    const main = document.querySelector('main, [role="main"], #main-content');
    if (main instanceof HTMLElement) {
      main.focus();
      announce('Main content focused');
    }
  };

  const focusNavigation = () => {
    const nav = document.querySelector('nav, [role="navigation"]');
    if (nav instanceof HTMLElement) {
      const firstLink = nav.querySelector('a, button');
      if (firstLink instanceof HTMLElement) {
        firstLink.focus();
        announce('Navigation focused');
      }
    }
  };

  const focusSearch = () => {
    const search = document.querySelector('input[type="search"], [role="search"] input');
    if (search instanceof HTMLElement) {
      search.focus();
      announce('Search focused');
    }
  };

  const isInputFocused = () => {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
  };

  const contextValue: AccessibilityContextType = {
    settings,
    isScreenReaderActive,
    currentFocusId,
    announcements,
    keyboardShortcuts,
    updateSetting,
    resetSettings,
    announce,
    clearAnnouncements,
    setFocus,
    getFocusableElements,
    trapFocus,
    registerShortcut,
    unregisterShortcut,
    getContrastRatio,
    isColorBlind
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* ARIA Live Regions for announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        ref={assertiveRegionRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}