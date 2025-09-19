/**
 * Utility functions for lazy loading components and resources
 */

import { useEffect, useState, useRef } from 'react';

/**
 * Hook to detect when an element is in the viewport
 * @param options IntersectionObserver options
 * @returns [ref, isIntersecting] - Ref to attach to element and boolean indicating if element is visible
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = {
    rootMargin: '200px', // Load when element is within 200px of viewport
    threshold: 0.1, // Trigger when at least 10% of element is visible
  }
): [React.RefObject<T>, boolean] {
  const [isIntersecting, setIntersecting] = useState(false);
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [options]);

  return [elementRef, isIntersecting];
}

/**
 * Hook to lazy load an image with a placeholder
 * @param src Image source URL
 * @param placeholderSrc Optional placeholder image URL
 * @returns [imgSrc, isLoaded, onLoad] - Current image source, loading state, and onLoad handler
 */
export function useLazyImage(
  src: string,
  placeholderSrc: string = ''
): [string, boolean, () => void] {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || src);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Reset state if src changes
    if (src !== imgSrc) {
      setIsLoaded(false);
      setImgSrc(placeholderSrc || src);
    }
  }, [src, placeholderSrc, imgSrc]);

  const onLoad = () => {
    setIsLoaded(true);
    if (placeholderSrc && imgSrc === placeholderSrc) {
      setImgSrc(src);
    }
  };

  return [imgSrc, isLoaded, onLoad];
}

/**
 * Preload a resource (image, audio, video) in the background
 * @param url URL of the resource to preload
 * @param type Type of resource ('image', 'audio', 'video', 'fetch')
 * @returns Promise that resolves when resource is loaded
 */
export function preloadResource(
  url: string,
  type: 'image' | 'audio' | 'video' | 'fetch' = 'image'
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (type === 'image') {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    } else if (type === 'audio' || type === 'video') {
      const media = type === 'audio' ? new Audio() : document.createElement('video');
      media.oncanplaythrough = () => resolve(media);
      media.onerror = reject;
      media.src = url;
      media.load();
    } else if (type === 'fetch') {
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to preload: ${response.status} ${response.statusText}`);
          }
          return response;
        })
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Detect if the browser supports the IntersectionObserver API
 * @returns Boolean indicating if IntersectionObserver is supported
 */
export function supportsIntersectionObserver(): boolean {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
}

/**
 * Detect if the browser supports native lazy loading for images
 * @returns Boolean indicating if native lazy loading is supported
 */
export function supportsNativeLazyLoading(): boolean {
  return typeof HTMLImageElement !== 'undefined' && 'loading' in HTMLImageElement.prototype;
}
