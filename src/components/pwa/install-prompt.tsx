'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { usePWA } from '@/hooks/use-pwa';
import {
  Download,
  X,
  Smartphone,
  Monitor,
  Zap,
  Wifi,
  Bell,
  Share
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstallPromptProps {
  className?: string;
  autoShow?: boolean;
  variant?: 'banner' | 'card' | 'modal';
}

export function InstallPrompt({ 
  className, 
  autoShow = true, 
  variant = 'banner' 
}: InstallPromptProps) {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (autoShow && isInstallable && !isInstalled) {
      // Show after a delay to not be intrusive
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, autoShow]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!isInstallable || isInstalled || !isVisible) {
    return null;
  }

  // Check if user has dismissed this session
  if (sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 shadow-lg transform transition-transform duration-300",
        className
      )}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Install DirectFanZ App</h3>
              <p className="text-sm text-indigo-100">
                Get the full app experience with offline access and push notifications
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <EnhancedButton
              variant="secondary"
              size="sm"
              onClick={handleInstall}
              className="bg-white text-indigo-600 hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Install
            </EnhancedButton>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-lg p-6 max-w-sm",
        className
      )}>
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mx-auto mb-3 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-bold text-xl text-gray-900 mb-2">Install DirectFanZ</h3>
          <p className="text-gray-600 text-sm">
            Install our app for the best experience with offline access and instant notifications
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span>Lightning fast performance</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Wifi className="w-4 h-4 text-indigo-500" />
            <span>Works offline</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Bell className="w-4 h-4 text-indigo-500" />
            <span>Push notifications</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Share className="w-4 h-4 text-indigo-500" />
            <span>Native sharing</span>
          </div>
        </div>

        <div className="flex gap-2">
          <EnhancedButton
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="flex-1"
          >
            Later
          </EnhancedButton>
          <EnhancedButton
            variant="primary"
            size="sm"
            onClick={handleInstall}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Install
          </EnhancedButton>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Install DirectFanZ</h2>
            <p className="text-gray-600">
              Get the full app experience with enhanced features and performance
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Zap className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Faster</p>
              <p className="text-xs text-gray-500">Native-like speed</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Wifi className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Offline</p>
              <p className="text-xs text-gray-500">Works without internet</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Bell className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Notifications</p>
              <p className="text-xs text-gray-500">Instant alerts</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Monitor className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Desktop</p>
              <p className="text-xs text-gray-500">Add to home screen</p>
            </div>
          </div>

          <div className="flex gap-3">
            <EnhancedButton
              variant="ghost"
              onClick={handleDismiss}
              className="flex-1"
            >
              Maybe Later
            </EnhancedButton>
            <EnhancedButton
              variant="primary"
              onClick={handleInstall}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </EnhancedButton>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Floating install button for pages
export function FloatingInstallButton({ className }: { className?: string }) {
  const { isInstallable, isInstalled, installApp } = usePWA();

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <button
      onClick={installApp}
      className={cn(
        "fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40",
        "hover:scale-110 active:scale-95",
        className
      )}
      aria-label="Install DirectFanZ App"
    >
      <Download className="w-6 h-6" />
    </button>
  );
}

// Install instructions for iOS Safari
export function IOSInstallInstructions() {
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsIOS(iOS && safari);
  }, []);

  if (!isIOS || !showInstructions) {
    return (
      <EnhancedButton
        variant="ghost"
        size="sm"
        onClick={() => setShowInstructions(true)}
        className="text-blue-600"
      >
        How to install on iOS
      </EnhancedButton>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-sm">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-blue-900">Install on iOS</h3>
        <button
          onClick={() => setShowInstructions(false)}
          className="text-blue-500 hover:text-blue-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-2 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <span className="font-medium">1.</span>
          <span>Tap the Share button in Safari</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium">2.</span>
          <span>Scroll down and tap "Add to Home Screen"</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium">3.</span>
          <span>Tap "Add" in the top right corner</span>
        </div>
      </div>
    </div>
  );
}