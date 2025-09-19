'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Share2,
  RotateCw,
  Move,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ImageViewerProps {
  src: string;
  alt: string;
  title?: string;
  contentId: string;
  images?: { id: string; src: string; alt: string; title?: string }[];
  currentIndex?: number;
  onImageChange?: (index: number) => void;
  className?: string;
}

export function ImageViewer({
  src,
  alt,
  title,
  contentId,
  images = [],
  currentIndex = 0,
  onImageChange,
  className,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track view analytics when image loads
  useEffect(() => {
    if (isLoaded && !hasTrackedView) {
      trackView();
      setHasTrackedView(true);
    }
  }, [isLoaded, hasTrackedView, contentId]);

  const trackView = async () => {
    try {
      await fetch('/api/content/analytics/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  const handlePreviousImage = () => {
    if (images.length === 0) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onImageChange?.(newIndex);
    handleReset();
  };

  const handleNextImage = () => {
    if (images.length === 0) return;
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onImageChange?.(newIndex);
    handleReset();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'image';
    link.click();
  };

  const currentImage = images.length > 0 ? images[currentIndex] : { src, alt, title };

  return (
    <>
      <Card className={`overflow-hidden ${className}`}>
        <div
          ref={containerRef}
          className='relative bg-black group cursor-zoom-in'
          onWheel={handleWheel}
          style={{ aspectRatio: '16/9' }}
        >
          <img
            ref={imageRef}
            src={currentImage.src}
            alt={currentImage.alt}
            className='w-full h-full object-contain transition-transform duration-200 ease-out select-none'
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onLoad={() => setIsLoaded(true)}
            onClick={() => zoom <= 1 && handleFullscreen()}
          />

          {/* Controls Overlay */}
          <div className='absolute top-4 left-4 right-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
            {title && (
              <div className='bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2'>
                <h3 className='text-white font-semibold'>{title}</h3>
              </div>
            )}

            <div className='flex items-center space-x-2'>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleZoomOut}
                disabled={zoom <= 0.1}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <ZoomOut className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleZoomIn}
                disabled={zoom >= 5}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <ZoomIn className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleRotate}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <RotateCw className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleReset}
                disabled={zoom === 1 && rotation === 0 && position.x === 0 && position.y === 0}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <Move className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {/* Navigation Arrows for Gallery */}
          {images.length > 1 && (
            <>
              <Button
                variant='secondary'
                size='sm'
                onClick={handlePreviousImage}
                className='absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleNextImage}
                className='absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200'
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </>
          )}

          {/* Bottom Controls */}
          <div className='absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
            {images.length > 1 && (
              <div className='bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm'>
                {currentIndex + 1} of {images.length}
              </div>
            )}

            <div className='flex items-center space-x-2 ml-auto'>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleDownload}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <Download className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <Share2 className='h-4 w-4' />
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleFullscreen}
                className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
              >
                <Maximize className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className='max-w-screen max-h-screen w-screen h-screen p-0 bg-black border-none'>
          <div className='relative w-full h-full flex items-center justify-center'>
            <img
              src={currentImage.src}
              alt={currentImage.alt}
              className='max-w-full max-h-full object-contain transition-transform duration-200 ease-out select-none'
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Fullscreen Controls */}
            <div className='absolute top-4 left-4 right-4 flex justify-between items-start'>
              {title && (
                <div className='bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2'>
                  <h3 className='text-white font-semibold'>{title}</h3>
                </div>
              )}

              <div className='flex items-center space-x-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.1}
                  className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <ZoomOut className='h-4 w-4' />
                </Button>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleZoomIn}
                  disabled={zoom >= 5}
                  className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <ZoomIn className='h-4 w-4' />
                </Button>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleRotate}
                  className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <RotateCw className='h-4 w-4' />
                </Button>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleReset}
                  disabled={zoom === 1 && rotation === 0 && position.x === 0 && position.y === 0}
                  className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <Move className='h-4 w-4' />
                </Button>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => setIsFullscreen(false)}
                  className='bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </div>

            {/* Fullscreen Navigation */}
            {images.length > 1 && (
              <>
                <Button
                  variant='secondary'
                  size='lg'
                  onClick={handlePreviousImage}
                  className='absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <ChevronLeft className='h-6 w-6' />
                </Button>
                <Button
                  variant='secondary'
                  size='lg'
                  onClick={handleNextImage}
                  className='absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 backdrop-blur-sm border-none text-white hover:bg-black/80'
                >
                  <ChevronRight className='h-6 w-6' />
                </Button>

                <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm'>
                  {currentIndex + 1} of {images.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
