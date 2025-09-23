'use client';

import { useState, useEffect, useCallback } from 'react';

interface ViewportInfo {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface DeviceCapabilities {
  supportsTouch: boolean;
  supportsHover: boolean;
  prefersReducedMotion: boolean;
  connectionType: string;
  devicePixelRatio: number;
}

export function useMobileOptimized() {
  const [viewport, setViewport] = useState<ViewportInfo>({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isTouch: false,
    orientation: 'portrait',
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities>({
    supportsTouch: false,
    supportsHover: false,
    prefersReducedMotion: false,
    connectionType: 'unknown',
    devicePixelRatio: 1
  });

  const updateViewport = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    const orientation = height > width ? 'portrait' : 'landscape';

    // Detect touch capability
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Get safe area values
    const computedStyle = getComputedStyle(document.documentElement);
    const safeArea = {
      top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
      bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
      left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0'),
      right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
    };

    setViewport({
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isTouch,
      orientation,
      safeArea
    });
  }, []);

  const updateDeviceCapabilities = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Check for touch support
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check for hover capability
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Get connection type (if available)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const connectionType = connection?.effectiveType || 'unknown';

    // Get device pixel ratio
    const devicePixelRatio = window.devicePixelRatio || 1;

    setDeviceCapabilities({
      supportsTouch,
      supportsHover,
      prefersReducedMotion,
      connectionType,
      devicePixelRatio
    });
  }, []);

  useEffect(() => {
    updateViewport();
    updateDeviceCapabilities();

    const handleResize = () => {
      updateViewport();
    };

    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated
      setTimeout(updateViewport, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateViewport, updateDeviceCapabilities]);

  // Utility functions
  const isMobileDevice = viewport.isMobile;
  const isLandscape = viewport.orientation === 'landscape';
  const isPortrait = viewport.orientation === 'portrait';
  const shouldUseReducedMotion = deviceCapabilities.prefersReducedMotion;
  const isSlowConnection = ['slow-2g', '2g'].includes(deviceCapabilities.connectionType);

  // Touch-optimized spacing
  const touchTargetSize = viewport.isMobile ? 44 : 40; // iOS/Android recommended minimum
  const spacing = {
    xs: viewport.isMobile ? 8 : 4,
    sm: viewport.isMobile ? 16 : 8,
    md: viewport.isMobile ? 24 : 16,
    lg: viewport.isMobile ? 32 : 24,
    xl: viewport.isMobile ? 48 : 32,
  };

  // Responsive breakpoints
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1280
  };

  return {
    viewport,
    deviceCapabilities,
    isMobileDevice,
    isLandscape,
    isPortrait,
    shouldUseReducedMotion,
    isSlowConnection,
    touchTargetSize,
    spacing,
    breakpoints,
    
    // Helper functions
    getOptimalImageSize: (baseSize: number) => {
      const multiplier = deviceCapabilities.devicePixelRatio;
      return Math.round(baseSize * multiplier);
    },

    shouldPreloadImages: () => {
      return !isSlowConnection && !deviceCapabilities.prefersReducedMotion;
    },

    getAnimationDuration: (baseDuration: number) => {
      return shouldUseReducedMotion ? 0 : baseDuration;
    },

    getTouchFeedbackStyle: () => {
      if (!deviceCapabilities.supportsTouch) return {};
      
      return {
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      };
    },

    getMobileOptimizedProps: () => ({
      style: {
        // Improve scrolling performance on mobile
        WebkitOverflowScrolling: 'touch',
        // Prevent zoom on form inputs
        fontSize: viewport.isMobile ? '16px' : undefined,
        // Safe area padding
        paddingTop: `env(safe-area-inset-top, ${spacing.sm}px)`,
        paddingBottom: `env(safe-area-inset-bottom, ${spacing.sm}px)`,
        paddingLeft: `env(safe-area-inset-left, ${spacing.sm}px)`,
        paddingRight: `env(safe-area-inset-right, ${spacing.sm}px)`,
      }
    })
  };
}

// Hook for managing touch gestures
export function useTouchGestures() {
  const [gestureState, setGestureState] = useState({
    isPressed: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null as 'left' | 'right' | 'up' | 'down' | null,
    velocity: 0
  });

  const handleTouchStart = useCallback((event: TouchEvent | React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    setGestureState(prev => ({
      ...prev,
      isPressed: true,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
      velocity: 0
    }));
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent | React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    setGestureState(prev => {
      const deltaX = touch.clientX - prev.startX;
      const deltaY = touch.clientY - prev.startY;
      
      let direction: 'left' | 'right' | 'up' | 'down' | null = null;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / (performance.now() - (prev as any).startTime || 1);

      return {
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX,
        deltaY,
        direction,
        velocity
      };
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    setGestureState(prev => ({
      ...prev,
      isPressed: false
    }));
  }, []);

  return {
    gestureState,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
}

// Hook for managing app-like behaviors
export function useAppLikeBehavior() {
  const { viewport, deviceCapabilities } = useMobileOptimized();
  
  useEffect(() => {
    if (!viewport.isMobile) return;

    // Prevent zoom on input focus
    const preventZoom = () => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0'
        );
      }
    };

    // Add to homescreen prompt handling
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store the event for later use
      (window as any).deferredPrompt = e;
    };

    // Status bar styling for PWA
    const setStatusBarStyle = () => {
      const statusBarMeta = document.querySelector('meta[name="theme-color"]');
      if (!statusBarMeta) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#4F46E5'; // Indigo-600
        document.head.appendChild(meta);
      }

      const statusBarStyleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!statusBarStyleMeta) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-status-bar-style';
        meta.content = 'default';
        document.head.appendChild(meta);
      }
    };

    preventZoom();
    setStatusBarStyle();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [viewport.isMobile]);

  const promptInstall = useCallback(async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    (window as any).deferredPrompt = null;
    
    return outcome === 'accepted';
  }, []);

  return {
    canInstall: !!(window as any)?.deferredPrompt,
    promptInstall
  };
}