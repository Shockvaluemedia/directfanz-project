'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeCarouselProps {
  children: ReactNode[];
  showDots?: boolean;
  showArrows?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemsPerView?: number;
  spacing?: number;
  className?: string;
}

export function SwipeCarousel({
  children,
  showDots = true,
  showArrows = true,
  autoPlay = false,
  autoPlayInterval = 5000,
  itemsPerView = 1,
  spacing = 16,
  className = '',
}: SwipeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const totalItems = children.length;
  const maxIndex = Math.max(0, totalItems - itemsPerView);

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && totalItems > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [autoPlay, autoPlayInterval, maxIndex, totalItems]);

  // Pause auto-play on interaction
  const pauseAutoPlay = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
  };

  // Resume auto-play after interaction
  const resumeAutoPlay = () => {
    if (autoPlay && totalItems > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
      }, autoPlayInterval);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    pauseAutoPlay();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      resumeAutoPlay();
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < maxIndex) {
      setCurrentIndex(prev => prev + 1);
    }

    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }

    setIsDragging(false);
    resumeAutoPlay();
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, maxIndex)));
    pauseAutoPlay();
    setTimeout(resumeAutoPlay, 3000); // Resume after 3 seconds of inactivity
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      pauseAutoPlay();
      setTimeout(resumeAutoPlay, 3000);
    }
  };

  const goToNext = () => {
    if (currentIndex < maxIndex) {
      setCurrentIndex(prev => prev + 1);
      pauseAutoPlay();
      setTimeout(resumeAutoPlay, 3000);
    }
  };

  const itemWidth = `calc(${100 / itemsPerView}% - ${(spacing * (itemsPerView - 1)) / itemsPerView}px)`;
  const translateX = -(currentIndex * (100 / itemsPerView));

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Carousel Container */}
      <div
        ref={carouselRef}
        className='overflow-hidden'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={`
            flex transition-transform duration-300 ease-out
            ${isDragging ? 'transition-none' : ''}
          `}
          style={{
            transform: `translateX(${translateX}%)`,
            gap: `${spacing}px`,
          }}
        >
          {children.map((child, index) => (
            <div key={index} className='flex-shrink-0' style={{ width: itemWidth }}>
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {showArrows && totalItems > itemsPerView && (
        <>
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className={`
              absolute left-2 top-1/2 -translate-y-1/2 z-10
              w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg
              flex items-center justify-center transition-all duration-200
              ${
                currentIndex === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white hover:shadow-xl active:scale-90'
              }
            `}
          >
            <ChevronLeft size={20} className='text-gray-700' />
          </button>

          <button
            onClick={goToNext}
            disabled={currentIndex >= maxIndex}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 z-10
              w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg
              flex items-center justify-center transition-all duration-200
              ${
                currentIndex >= maxIndex
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white hover:shadow-xl active:scale-90'
              }
            `}
          >
            <ChevronRight size={20} className='text-gray-700' />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {showDots && totalItems > itemsPerView && (
        <div className='flex justify-center mt-4 space-x-2'>
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`
                w-2 h-2 rounded-full transition-all duration-200 touch-manipulation
                ${index === currentIndex ? 'bg-indigo-600 w-6' : 'bg-gray-300 hover:bg-gray-400'}
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Specialized carousel for content cards
export function ContentCarousel({
  items,
  className = '',
}: {
  items: Array<{
    id: string;
    title: string;
    thumbnail?: string;
    artist: string;
    duration?: string;
    price?: string;
  }>;
  className?: string;
}) {
  return (
    <SwipeCarousel
      className={className}
      itemsPerView={1.2}
      spacing={12}
      showArrows={false}
      showDots={false}
    >
      {items.map(item => (
        <div
          key={item.id}
          className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'
        >
          <div className='aspect-video bg-gray-100 flex items-center justify-center'>
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title} className='w-full h-full object-cover' />
            ) : (
              <div className='text-gray-400'>No thumbnail</div>
            )}
          </div>
          <div className='p-3'>
            <h3 className='font-medium text-sm text-gray-900 truncate'>{item.title}</h3>
            <p className='text-xs text-gray-500 mt-1'>{item.artist}</p>
            <div className='flex justify-between items-center mt-2'>
              {item.duration && <span className='text-xs text-gray-400'>{item.duration}</span>}
              {item.price && (
                <span className='text-xs font-medium text-indigo-600'>{item.price}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </SwipeCarousel>
  );
}
