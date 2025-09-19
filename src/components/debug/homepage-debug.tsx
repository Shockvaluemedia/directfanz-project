'use client';

import { useEffect, useState } from 'react';

export default function HomepageDebug() {
  const [isClient, setIsClient] = useState(false);
  const [components, setComponents] = useState({
    framerMotion: false,
    tailwind: false,
    animations: false,
    testimonialCarousel: false,
    animatedCounter: false,
  });

  useEffect(() => {
    setIsClient(true);

    // Test Framer Motion
    try {
      const motion = require('framer-motion');
      setComponents(prev => ({ ...prev, framerMotion: !!motion }));
    } catch (e) {
      console.error('Framer Motion not loaded:', e);
    }

    // Test Tailwind (check if styles are applied)
    const testDiv = document.createElement('div');
    testDiv.className = 'bg-red-500 w-4 h-4';
    document.body.appendChild(testDiv);
    const styles = window.getComputedStyle(testDiv);
    setComponents(prev => ({
      ...prev,
      tailwind: styles.backgroundColor === 'rgb(239, 68, 68)',
    }));
    document.body.removeChild(testDiv);

    // Test CSS animations
    const animatedDiv = document.createElement('div');
    animatedDiv.className = 'animate-pulse';
    document.body.appendChild(animatedDiv);
    const animStyles = window.getComputedStyle(animatedDiv);
    setComponents(prev => ({
      ...prev,
      animations: animStyles.animationName !== 'none',
    }));
    document.body.removeChild(animatedDiv);

    // Test if components exist
    setComponents(prev => ({
      ...prev,
      testimonialCarousel: document.querySelector('.testimonial-carousel') !== null,
      animatedCounter: document.querySelector('[data-counter]') !== null,
    }));
  }, []);

  if (!isClient) return null;

  return (
    <div className='fixed bottom-4 right-4 z-50 bg-black/80 text-white p-4 rounded-lg text-xs'>
      <h3 className='font-bold mb-2'>Homepage Debug</h3>
      <div className='space-y-1'>
        <div className={components.framerMotion ? 'text-green-400' : 'text-red-400'}>
          Framer Motion: {components.framerMotion ? '✓' : '✗'}
        </div>
        <div className={components.tailwind ? 'text-green-400' : 'text-red-400'}>
          Tailwind CSS: {components.tailwind ? '✓' : '✗'}
        </div>
        <div className={components.animations ? 'text-green-400' : 'text-red-400'}>
          CSS Animations: {components.animations ? '✓' : '✗'}
        </div>
        <div className={components.testimonialCarousel ? 'text-green-400' : 'text-red-400'}>
          Testimonial Carousel: {components.testimonialCarousel ? '✓' : '✗'}
        </div>
        <div className={components.animatedCounter ? 'text-green-400' : 'text-red-400'}>
          Animated Counter: {components.animatedCounter ? '✓' : '✗'}
        </div>
      </div>
    </div>
  );
}
