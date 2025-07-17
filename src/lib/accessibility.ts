/**
 * Accessibility utilities for implementing WCAG AA compliance
 */

/**
 * Keyboard navigation helper for handling keyboard events
 * @param event Keyboard event
 * @param actions Object mapping key codes to handler functions
 */
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  actions: Record<string, () => void>
) {
  const { key } = event;
  
  if (actions[key]) {
    event.preventDefault();
    actions[key]();
  }
}

/**
 * Creates an accessible announcement for screen readers
 * @param message Message to announce
 * @param politeness ARIA live region politeness setting
 */
export function announceToScreenReader(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
) {
  // Find or create the live region element
  let liveRegion = document.getElementById('a11y-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }
  
  // Set the message
  liveRegion.textContent = message;
  
  // Clear the message after a delay to prevent multiple readings
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 3000);
}

/**
 * Focus trap for modal dialogs
 * @param containerRef Ref to the container element
 * @param isActive Whether the focus trap is active
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean
) {
  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // If shift + tab and on first element, move to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // If tab and on last element, move to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
    
    // Focus the first element when trap activates
    firstElement?.focus();
    
    // Add event listener
    document.addEventListener('keydown', handleTabKey);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [containerRef, isActive]);
}

/**
 * Skip link component props
 */
export interface SkipLinkProps {
  targetId: string;
  className?: string;
}

/**
 * Contrast checker utility
 * @param foreground Foreground color in hex format
 * @param background Background color in hex format
 * @returns Contrast ratio
 */
export function checkContrast(foreground: string, background: string): number {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };
  
  // Calculate relative luminance
  const luminance = (r: number, g: number, b: number) => {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };
  
  const rgb1 = hexToRgb(foreground);
  const rgb2 = hexToRgb(background);
  
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  
  // Calculate contrast ratio
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  
  return parseFloat(ratio.toFixed(2));
}

/**
 * WCAG AA compliance check for contrast
 * @param ratio Contrast ratio
 * @param isLargeText Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the contrast meets WCAG AA standards
 */
export function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}