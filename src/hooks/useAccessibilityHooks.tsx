'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAccessibility } from '@/contexts/AccessibilityContext';

// Screen Reader Hook
export function useScreenReader() {
  const { announce, isScreenReaderActive, settings } = useAccessibility();

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  const announceNavigation = useCallback((location: string) => {
    if (isScreenReaderActive) {
      announce(`Navigated to ${location}`, 'polite');
    }
  }, [announce, isScreenReaderActive]);

  const announceFormError = useCallback((fieldName: string, error: string) => {
    announce(`Error in ${fieldName}: ${error}`, 'assertive');
  }, [announce]);

  const announceFormSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  const announceLoadingStart = useCallback((context: string) => {
    announce(`Loading ${context}...`, 'polite');
  }, [announce]);

  const announceLoadingEnd = useCallback((context: string) => {
    announce(`${context} loaded`, 'polite');
  }, [announce]);

  return {
    isActive: isScreenReaderActive,
    announce: announcePolite,
    announceUrgent: announceAssertive,
    announceNavigation,
    announceFormError,
    announceFormSuccess,
    announceLoadingStart,
    announceLoadingEnd,
    isDescriptiveMode: settings.descriptiveAltText
  };
}

// Focus Management Hook
export function useFocusManagement() {
  const { setFocus, getFocusableElements, trapFocus, currentFocusId } = useAccessibility();
  const [focusHistory, setFocusHistory] = useState<string[]>([]);

  const focusElement = useCallback((elementId: string, options?: { 
    preventScroll?: boolean;
    selectText?: boolean;
  }) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus({ preventScroll: options?.preventScroll });
      
      if (options?.selectText && element instanceof HTMLInputElement) {
        element.select();
      }

      setFocusHistory(prev => [...prev.slice(-9), elementId]); // Keep last 10
      setFocus(elementId);
    }
  }, [setFocus]);

  const focusPrevious = useCallback(() => {
    if (focusHistory.length > 1) {
      const previous = focusHistory[focusHistory.length - 2];
      focusElement(previous);
    }
  }, [focusHistory, focusElement]);

  const focusFirst = useCallback((container?: HTMLElement) => {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0 && focusable[0].id) {
      focusElement(focusable[0].id);
    }
  }, [getFocusableElements, focusElement]);

  const focusLast = useCallback((container?: HTMLElement) => {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      const last = focusable[focusable.length - 1];
      if (last.id) {
        focusElement(last.id);
      }
    }
  }, [getFocusableElements, focusElement]);

  const createFocusTrap = useCallback((containerRef: React.RefObject<HTMLElement>) => {
    if (!containerRef.current) return () => {};
    return trapFocus(containerRef.current);
  }, [trapFocus]);

  return {
    currentFocusId,
    focusHistory,
    focusElement,
    focusPrevious,
    focusFirst,
    focusLast,
    createFocusTrap,
    getFocusableElements
  };
}

// Keyboard Navigation Hook
export function useKeyboardNavigation() {
  const { registerShortcut, unregisterShortcut, settings } = useAccessibility();
  const [shortcuts, setShortcuts] = useState<Map<string, { description: string; callback: () => void }>>(new Map());

  const addShortcut = useCallback((
    key: string, 
    callback: () => void, 
    description: string
  ) => {
    registerShortcut(key, callback);
    setShortcuts(prev => new Map(prev.set(key, { description, callback })));
  }, [registerShortcut]);

  const removeShortcut = useCallback((key: string) => {
    unregisterShortcut(key);
    setShortcuts(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, [unregisterShortcut]);

  const getShortcutHelp = useCallback(() => {
    const help = Array.from(shortcuts.entries()).map(([key, { description }]) => ({
      key,
      description
    }));

    // Add default shortcuts
    const defaultShortcuts = [
      { key: 'Alt + 1', description: 'Jump to main content' },
      { key: 'Alt + 2', description: 'Jump to navigation' },
      { key: 'Alt + S', description: 'Jump to search' },
      { key: '/', description: 'Focus search (when not in input)' },
      { key: 'Escape', description: 'Close modal or dropdown' },
      { key: 'Tab', description: 'Navigate forward' },
      { key: 'Shift + Tab', description: 'Navigate backward' }
    ];

    return [...help, ...defaultShortcuts];
  }, [shortcuts]);

  // Arrow key navigation setup function (returns cleanup function)
  const createArrowNavigation = useCallback((
    containerRef: React.RefObject<HTMLElement>,
    options: {
      orientation?: 'horizontal' | 'vertical' | 'grid';
      wrap?: boolean;
      columns?: number;
    } = {}
  ) => {
    if (!containerRef.current || !settings.keyboardNavigation) {
      return () => {};
    }

    const container = containerRef.current;
    const { orientation = 'vertical', wrap = true, columns = 1 } = options;

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusableElements = Array.from(
        container.querySelectorAll('[tabindex]:not([tabindex="-1"]), button, input, select, textarea, a[href]')
      ) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const currentIndex = focusableElements.findIndex(el => el === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      let handled = false;

      switch (event.key) {
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'grid') {
            nextIndex = orientation === 'grid' 
              ? Math.max(0, currentIndex - columns)
              : Math.max(0, currentIndex - 1);
            handled = true;
          }
          break;

        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'grid') {
            nextIndex = orientation === 'grid'
              ? Math.min(focusableElements.length - 1, currentIndex + columns)
              : Math.min(focusableElements.length - 1, currentIndex + 1);
            handled = true;
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'grid') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : (wrap ? focusableElements.length - 1 : currentIndex);
            handled = true;
          }
          break;

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'grid') {
            nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : (wrap ? 0 : currentIndex);
            handled = true;
          }
          break;

        case 'Home':
          nextIndex = 0;
          handled = true;
          break;

        case 'End':
          nextIndex = focusableElements.length - 1;
          handled = true;
          break;
      }

      if (handled && nextIndex !== currentIndex) {
        event.preventDefault();
        focusableElements[nextIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [settings.keyboardNavigation]);

  return {
    isEnabled: settings.keyboardNavigation,
    addShortcut,
    removeShortcut,
    getShortcutHelp,
    createArrowNavigation,
    shortcuts: Array.from(shortcuts.entries())
  };
}

// ARIA Utilities Hook
export function useAriaUtilities() {
  const { announce, settings } = useAccessibility();
  const [ariaDescriptions, setAriaDescriptions] = useState<Map<string, string>>(new Map());

  const generateId = useCallback((prefix: string = 'aria') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const createAriaDescription = useCallback((text: string) => {
    const id = generateId('desc');
    setAriaDescriptions(prev => new Map(prev.set(id, text)));
    return id;
  }, [generateId]);

  const removeAriaDescription = useCallback((id: string) => {
    setAriaDescriptions(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const getAriaProps = useCallback((
    element: {
      label?: string;
      description?: string;
      required?: boolean;
      invalid?: boolean;
      expanded?: boolean;
      selected?: boolean;
      pressed?: boolean;
      current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
    } = {}
  ) => {
    const props: Record<string, any> = {};

    if (element.label) {
      props['aria-label'] = element.label;
    }

    if (element.description) {
      const descId = createAriaDescription(element.description);
      props['aria-describedby'] = descId;
    }

    if (element.required !== undefined) {
      props['aria-required'] = element.required;
    }

    if (element.invalid !== undefined) {
      props['aria-invalid'] = element.invalid;
    }

    if (element.expanded !== undefined) {
      props['aria-expanded'] = element.expanded;
    }

    if (element.selected !== undefined) {
      props['aria-selected'] = element.selected;
    }

    if (element.pressed !== undefined) {
      props['aria-pressed'] = element.pressed;
    }

    if (element.current !== undefined) {
      props['aria-current'] = element.current;
    }

    return props;
  }, [createAriaDescription]);

  const createLiveRegion = useCallback((
    priority: 'polite' | 'assertive' = 'polite',
    atomic: boolean = true
  ) => {
    const id = generateId('live');
    const element = document.createElement('div');
    element.id = id;
    element.setAttribute('aria-live', priority);
    element.setAttribute('aria-atomic', atomic.toString());
    element.className = 'sr-only';
    document.body.appendChild(element);

    const update = (message: string) => {
      element.textContent = message;
      setTimeout(() => {
        element.textContent = '';
      }, 1000);
    };

    const remove = () => {
      element.remove();
    };

    return { id, update, remove };
  }, [generateId]);

  const announcePage = useCallback((title: string, description?: string) => {
    let message = `Page: ${title}`;
    if (description) {
      message += `, ${description}`;
    }
    announce(message, 'polite');
  }, [announce]);

  const announceModal = useCallback((title: string, isOpen: boolean) => {
    const message = isOpen ? `Modal opened: ${title}` : `Modal closed`;
    announce(message, 'assertive');
  }, [announce]);

  const announceList = useCallback((
    itemCount: number, 
    context: string, 
    currentIndex?: number
  ) => {
    let message = `${context} list with ${itemCount} items`;
    if (currentIndex !== undefined) {
      message += `, item ${currentIndex + 1} of ${itemCount}`;
    }
    announce(message, 'polite');
  }, [announce]);

  return {
    generateId,
    createAriaDescription,
    removeAriaDescription,
    getAriaProps,
    createLiveRegion,
    announcePage,
    announceModal,
    announceList,
    descriptions: Array.from(ariaDescriptions.entries()),
    isDescriptiveMode: settings.descriptiveAltText
  };
}

// Skip Links Hook
export function useSkipLinks() {
  const { announce } = useAccessibility();
  const [skipLinks, setSkipLinks] = useState<Array<{
    id: string;
    label: string;
    target: string;
  }>>([]);

  const addSkipLink = useCallback((
    target: string, 
    label: string, 
    id?: string
  ) => {
    const linkId = id || `skip-${target}`;
    setSkipLinks(prev => [
      ...prev.filter(link => link.id !== linkId),
      { id: linkId, label, target }
    ]);
  }, []);

  const removeSkipLink = useCallback((id: string) => {
    setSkipLinks(prev => prev.filter(link => link.id !== id));
  }, []);

  const navigateToTarget = useCallback((target: string) => {
    const element = document.querySelector(target);
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      announce(`Jumped to ${element.textContent || target}`);
    }
  }, [announce]);

  const SkipLinksComponent = useCallback((): React.JSX.Element => (
    <div className="skip-links">
      {skipLinks.map(({ id, label, target }) => (
        <a
          key={id}
          href={`#${target}`}
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-blue-600 focus:text-white focus:no-underline"
          onClick={(e) => {
            e.preventDefault();
            navigateToTarget(`#${target}`);
          }}
        >
          {label}
        </a>
      ))}
    </div>
  ), [skipLinks, navigateToTarget]);

  useEffect(() => {
    // Add default skip links
    addSkipLink('main-content', 'Skip to main content');
    addSkipLink('navigation', 'Skip to navigation');
    addSkipLink('footer', 'Skip to footer');
  }, [addSkipLink]);

  return {
    skipLinks,
    addSkipLink,
    removeSkipLink,
    navigateToTarget,
    SkipLinksComponent
  };
}