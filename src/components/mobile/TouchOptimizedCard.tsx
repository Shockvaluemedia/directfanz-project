'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Heart, Share2, MessageCircle, Bookmark, MoreHorizontal } from 'lucide-react';

interface TouchOptimizedCardProps {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  avatar?: string;
  artistName: string;
  duration?: string;
  likes?: number;
  comments?: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  onTap?: () => void;
  className?: string;
}

export function TouchOptimizedCard({
  id,
  title,
  subtitle,
  imageUrl,
  avatar,
  artistName,
  duration,
  likes = 0,
  comments = 0,
  isLiked = false,
  isBookmarked = false,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onTap,
  className = ''
}: TouchOptimizedCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);
  const scale = useTransform(x, [-100, 0, 100], [0.95, 1, 0.95]);

  // Handle swipe gestures for quick actions
  const handlePanEnd = useCallback((event: Event, info: PanInfo) => {
    const swipeThreshold = 50;
    
    if (info.offset.x > swipeThreshold) {
      // Swipe right - like action
      onLike?.();
    } else if (info.offset.x < -swipeThreshold) {
      // Swipe left - bookmark action
      onBookmark?.();
    }
    
    // Reset position
    x.set(0);
  }, [onLike, onBookmark, x]);

  // Touch feedback handlers
  const handlePressStart = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleLongPress = useCallback(() => {
    setShowActions(!showActions);
  }, [showActions]);

  return (
    <motion.div 
      ref={constraintsRef}
      className={`relative bg-white rounded-2xl shadow-soft overflow-hidden ${className}`}
      style={{ opacity, scale }}
    >
      <motion.div
        drag="x"
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onPanEnd={handlePanEnd}
        style={{ x }}
        className="relative"
        onTapStart={handlePressStart}
        onTap={onTap}
        onTapCancel={handlePressEnd}
        onPointerUp={handlePressEnd}
        whileTap={{ scale: 0.98 }}
        animate={{ 
          scale: isPressed ? 0.98 : 1,
          transition: { duration: 0.1 }
        }}
      >
        {/* Content Image/Video Thumbnail */}
        {imageUrl && (
          <div className="relative aspect-video bg-gray-200 rounded-t-2xl overflow-hidden">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {/* Duration Badge */}
            {duration && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
                {duration}
              </div>
            )}

            {/* Swipe Indicators */}
            <motion.div 
              className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-red-500 to-transparent opacity-0 flex items-center justify-center"
              animate={{ opacity: x.get() > 20 ? 0.8 : 0 }}
            >
              <Heart className="w-6 h-6 text-white" fill="white" />
            </motion.div>
            
            <motion.div 
              className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-blue-500 to-transparent opacity-0 flex items-center justify-center"
              animate={{ opacity: x.get() < -20 ? 0.8 : 0 }}
            >
              <Bookmark className="w-6 h-6 text-white" fill="white" />
            </motion.div>
          </div>
        )}

        {/* Content Info */}
        <div className="p-4 space-y-3">
          {/* Artist Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={artistName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-medium text-sm">
                  {artistName.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{artistName}</p>
              {subtitle && (
                <p className="text-sm text-gray-500 truncate">{subtitle}</p>
              )}
            </div>
            
            {/* Long Press Menu Trigger */}
            <motion.button
              onLongPress={handleLongPress}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </motion.button>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-2">
            {title}
          </h3>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-6">
              {/* Like Button */}
              <motion.button
                onClick={onLike}
                whileTap={{ scale: 0.9 }}
                className="flex items-center space-x-2 text-gray-600 hover:text-red-500 active:text-red-600 transition-colors"
              >
                <motion.div
                  animate={{ scale: isLiked ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Heart 
                    className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : ''}`}
                  />
                </motion.div>
                <span className="text-sm font-medium">{likes}</span>
              </motion.button>

              {/* Comment Button */}
              <motion.button
                onClick={onComment}
                whileTap={{ scale: 0.9 }}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-500 active:text-blue-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{comments}</span>
              </motion.button>

              {/* Share Button */}
              <motion.button
                onClick={onShare}
                whileTap={{ scale: 0.9 }}
                className="text-gray-600 hover:text-green-500 active:text-green-600 transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Bookmark Button */}
            <motion.button
              onClick={onBookmark}
              whileTap={{ scale: 0.9 }}
              className="text-gray-600 hover:text-yellow-500 active:text-yellow-600 transition-colors"
            >
              <Bookmark 
                className={`w-5 h-5 ${isBookmarked ? 'text-yellow-500 fill-yellow-500' : ''}`}
              />
            </motion.button>
          </div>
        </div>

        {/* Action Menu Overlay */}
        <motion.div
          initial={false}
          animate={{
            opacity: showActions ? 1 : 0,
            y: showActions ? 0 : 20,
            scale: showActions ? 1 : 0.95
          }}
          className={`absolute inset-x-4 bottom-4 bg-white rounded-xl shadow-large border border-gray-200 p-3 ${
            showActions ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="grid grid-cols-4 gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { onLike?.(); setShowActions(false); }}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <Heart className="w-6 h-6 text-red-500 mb-1" />
              <span className="text-xs text-gray-700">Like</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { onComment?.(); setShowActions(false); }}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors"
            >
              <MessageCircle className="w-6 h-6 text-blue-500 mb-1" />
              <span className="text-xs text-gray-700">Comment</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { onShare?.(); setShowActions(false); }}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-green-50 active:bg-green-100 transition-colors"
            >
              <Share2 className="w-6 h-6 text-green-500 mb-1" />
              <span className="text-xs text-gray-700">Share</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { onBookmark?.(); setShowActions(false); }}
              className="flex flex-col items-center p-3 rounded-lg hover:bg-yellow-50 active:bg-yellow-100 transition-colors"
            >
              <Bookmark className="w-6 h-6 text-yellow-500 mb-1" />
              <span className="text-xs text-gray-700">Save</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}