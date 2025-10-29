'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Type, 
  Contrast, 
  Palette, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  X,
  Sun,
  Moon,
  Monitor,
  Accessibility,
  Volume2,
  VolumeX,
  MousePointer,
  Minus,
  Plus,
  AlertTriangle,
  Minimize2,
  Motion
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader } from '@/hooks/useAccessibilityHooks';

interface VisualAccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface ThemeOption {
  id: string;
  name: string;
  description: string;
  preview: {
    background: string;
    text: string;
    accent: string;
  };
}

interface AccessibilityFloatingButtonProps {
  className?: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard color scheme',
    preview: {
      background: '#ffffff',
      text: '#111827',
      accent: '#4f46e5'
    }
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'High contrast black and white',
    preview: {
      background: '#000000',
      text: '#ffffff',
      accent: '#ffff00'
    }
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Dark background with light text',
    preview: {
      background: '#1f2937',
      text: '#f9fafb',
      accent: '#60a5fa'
    }
  },
  {
    id: 'colorblind-deuteranopia',
    name: 'Deuteranopia Friendly',
    description: 'Optimized for red-green colorblindness',
    preview: {
      background: '#ffffff',
      text: '#111827',
      accent: '#0891b2'
    }
  },
  {
    id: 'colorblind-protanopia',
    name: 'Protanopia Friendly',
    description: 'Optimized for red colorblindness',
    preview: {
      background: '#ffffff',
      text: '#111827',
      accent: '#7c3aed'
    }
  },
  {
    id: 'colorblind-tritanopia',
    name: 'Tritanopia Friendly',
    description: 'Optimized for blue colorblindness',
    preview: {
      background: '#ffffff',
      text: '#111827',
      accent: '#dc2626'
    }
  }
];

// Main Visual Accessibility Panel
export function VisualAccessibilityPanel({
  isOpen,
  onClose,
  className = ''
}: VisualAccessibilityPanelProps) {
  const { settings, updateSetting, resetSettings } = useAccessibility();
  const { announce } = useScreenReader();
  const [activeTab, setActiveTab] = useState<'visual' | 'interaction' | 'content'>('visual');

  const handleSettingChange = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    updateSetting(key, value);
    announce(`${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleTextSizeChange = (size: 'small' | 'medium' | 'large' | 'extra-large') => {
    updateSetting('textSize', size);
    announce(`Text size changed to ${size}`);
  };

  const handleThemeChange = (themeId: string) => {
    const theme = themeOptions.find(t => t.id === themeId);
    if (!theme) return;

    // Apply theme-specific settings
    switch (themeId) {
      case 'high-contrast':
        updateSetting('highContrast', true);
        updateSetting('colorBlindFriendly', false);
        break;
      case 'dark':
        updateSetting('highContrast', false);
        updateSetting('colorBlindFriendly', false);
        break;
      case 'colorblind-deuteranopia':
      case 'colorblind-protanopia':
      case 'colorblind-tritanopia':
        updateSetting('colorBlindFriendly', true);
        updateSetting('highContrast', false);
        break;
      default:
        updateSetting('highContrast', false);
        updateSetting('colorBlindFriendly', false);
    }

    announce(`Theme changed to ${theme.name}`);
  };

  const handleReset = () => {
    resetSettings();
    announce('All accessibility settings reset to default');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden ${className}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Accessibility className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Accessibility Settings
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Reset All
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close accessibility settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex h-96">
          {/* Sidebar Navigation */}
          <div className="w-48 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {[
                { id: 'visual', label: 'Visual', icon: Eye },
                { id: 'interaction', label: 'Interaction', icon: MousePointer },
                { id: 'content', label: 'Content', icon: Type }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Visual Settings */}
              {activeTab === 'visual' && (
                <div className="space-y-6">
                  {/* Color Themes */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Color Themes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {themeOptions.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex-shrink-0 mr-3">
                            <div className="w-12 h-8 rounded border border-gray-300 flex">
                              <div
                                className="w-1/2 h-full rounded-l"
                                style={{ backgroundColor: theme.preview.background }}
                              />
                              <div
                                className="w-1/4 h-full"
                                style={{ backgroundColor: theme.preview.text }}
                              />
                              <div
                                className="w-1/4 h-full rounded-r"
                                style={{ backgroundColor: theme.preview.accent }}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {theme.name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {theme.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Size */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Text Size
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {(['small', 'medium', 'large', 'extra-large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => handleTextSizeChange(size)}
                          className={`p-3 border border-gray-200 rounded-lg text-center transition-colors ${
                            settings.textSize === size
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Type className={`w-${size === 'small' ? '4' : size === 'medium' ? '5' : size === 'large' ? '6' : '7'} h-${size === 'small' ? '4' : size === 'medium' ? '5' : size === 'large' ? '6' : '7'} mx-auto mb-2`} />
                          <span className={`capitalize ${
                            size === 'small' ? 'text-sm' : 
                            size === 'medium' ? 'text-base' : 
                            size === 'large' ? 'text-lg' : 'text-xl'
                          }`}>
                            {size}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Options */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Visual Options
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Contrast className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              High Contrast
                            </span>
                            <p className="text-sm text-gray-500">
                              Increase contrast for better readability
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('highContrast', !settings.highContrast)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.highContrast ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.highContrast ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Palette className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Color Blind Friendly
                            </span>
                            <p className="text-sm text-gray-500">
                              Use colors that are accessible for color blindness
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('colorBlindFriendly', !settings.colorBlindFriendly)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.colorBlindFriendly ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.colorBlindFriendly ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Motion className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Reduce Motion
                            </span>
                            <p className="text-sm text-gray-500">
                              Minimize animations and transitions
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('reducedMotion', !settings.reducedMotion)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.reducedMotion ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Interaction Settings */}
              {activeTab === 'interaction' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Navigation & Controls
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <MousePointer className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Keyboard Navigation
                            </span>
                            <p className="text-sm text-gray-500">
                              Enable keyboard shortcuts and navigation
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('keyboardNavigation', !settings.keyboardNavigation)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.keyboardNavigation ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.keyboardNavigation ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Eye className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Focus Indicators
                            </span>
                            <p className="text-sm text-gray-500">
                              Show visible focus indicators for interactive elements
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('focusVisible', !settings.focusVisible)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.focusVisible ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.focusVisible ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Media Controls
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Volume2 className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Auto-play Disabled
                            </span>
                            <p className="text-sm text-gray-500">
                              Prevent videos and audio from playing automatically
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('autoPlayDisabled', !settings.autoPlayDisabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.autoPlayDisabled ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.autoPlayDisabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Settings */}
              {activeTab === 'content' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Screen Reader Settings
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Volume2 className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Screen Reader Mode
                            </span>
                            <p className="text-sm text-gray-500">
                              Optimize interface for screen reader users
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('screenReaderMode', !settings.screenReaderMode)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.screenReaderMode ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.screenReaderMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Eye className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Descriptive Alt Text
                            </span>
                            <p className="text-sm text-gray-500">
                              Use detailed descriptions for images and media
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('descriptiveAltText', !settings.descriptiveAltText)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.descriptiveAltText ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.descriptiveAltText ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Content Preferences
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Content Warnings
                            </span>
                            <p className="text-sm text-gray-500">
                              Show warnings for sensitive content
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('contentWarnings', !settings.contentWarnings)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.contentWarnings ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.contentWarnings ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Minimize2 className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              Simplified Interface
                            </span>
                            <p className="text-sm text-gray-500">
                              Use a cleaner, less cluttered design
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('simplifiedInterface', !settings.simplifiedInterface)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.simplifiedInterface ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.simplifiedInterface ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Floating Accessibility Button
export function AccessibilityFloatingButton({ className = '' }: AccessibilityFloatingButtonProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setIsPanelOpen(true)}
        className={`fixed bottom-20 right-8 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors z-40 ${className}`}
        aria-label="Open accessibility settings"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Accessibility className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {isPanelOpen && (
          <VisualAccessibilityPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}