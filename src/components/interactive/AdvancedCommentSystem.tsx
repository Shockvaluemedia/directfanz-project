'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  ThumbsUp, 
  ThumbsDown, 
  Smile, 
  Reply, 
  MoreHorizontal, 
  Flag,
  Share,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Pin,
  Award
} from 'lucide-react';

interface Reaction {
  id: string;
  type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorBadge?: 'verified' | 'supporter' | 'creator';
  createdAt: Date;
  updatedAt?: Date;
  reactions: Reaction[];
  totalReactions: number;
  replies: Comment[];
  replyCount: number;
  isPinned?: boolean;
  isEdited?: boolean;
  parentId?: string;
  level: number;
}

interface AdvancedCommentSystemProps {
  contentId: string;
  comments: Comment[];
  currentUserId?: string;
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onReact: (commentId: string, reactionType: Reaction['type']) => Promise<void>;
  onPin: (commentId: string) => Promise<void>;
  onReport: (commentId: string, reason: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  maxNestLevel?: number;
  className?: string;
}

const reactionEmojis: Record<Reaction['type'], string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠'
};

const badgeIcons = {
  verified: <Award className="w-4 h-4 text-blue-500" />,
  supporter: <Heart className="w-4 h-4 text-pink-500" />,
  creator: <Pin className="w-4 h-4 text-purple-500" />
};

export function AdvancedCommentSystem({
  contentId,
  comments,
  currentUserId,
  onAddComment,
  onReact,
  onPin,
  onReport,
  onDelete,
  maxNestLevel = 3,
  className = ''
}: AdvancedCommentSystemProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [collapsedComments, setCollapsedComments] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  // Sort and organize comments
  const sortedComments = useMemo(() => {
    const sorted = [...comments].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'popular':
          return b.totalReactions - a.totalReactions;
        default:
          return 0;
      }
    });

    // Move pinned comments to top
    const pinned = sorted.filter(c => c.isPinned && c.level === 0);
    const unpinned = sorted.filter(c => !c.isPinned || c.level > 0);
    
    return [...pinned, ...unpinned];
  }, [comments, sortBy]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;
    
    try {
      await onAddComment(newComment);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }, [newComment, onAddComment]);

  const handleSubmitReply = useCallback(async (parentId: string) => {
    if (!replyContent.trim()) return;
    
    try {
      await onAddComment(replyContent, parentId);
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  }, [replyContent, onAddComment]);

  const handleReaction = useCallback(async (commentId: string, type: Reaction['type']) => {
    try {
      await onReact(commentId, type);
      setShowReactions(null);
    } catch (error) {
      console.error('Failed to react:', error);
    }
  }, [onReact]);

  const toggleCollapse = useCallback((commentId: string) => {
    setCollapsedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, []);

  const ReactionButton = ({ reactions, commentId }: { reactions: Reaction[], commentId: string }) => {
    const topReactions = reactions
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

    if (totalCount === 0) {
      return (
        <motion.button
          onClick={() => setShowReactions(showReactions === commentId ? null : commentId)}
          className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <Smile className="w-4 h-4" />
          <span className="text-sm">React</span>
        </motion.button>
      );
    }

    return (
      <div className="flex items-center space-x-1">
        <motion.button
          onClick={() => setShowReactions(showReactions === commentId ? null : commentId)}
          className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          {topReactions.map(reaction => (
            <span key={reaction.type} className="text-sm">
              {reactionEmojis[reaction.type]}
            </span>
          ))}
          <span className="text-sm font-medium text-gray-700 ml-1">
            {totalCount}
          </span>
        </motion.button>
      </div>
    );
  };

  const ReactionPicker = ({ commentId }: { commentId: string }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-large border border-gray-200 p-2 flex space-x-2 z-10"
    >
      {Object.entries(reactionEmojis).map(([type, emoji]) => (
        <motion.button
          key={type}
          onClick={() => handleReaction(commentId, type as Reaction['type'])}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-lg transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );

  const CommentItem = ({ comment, isReply = false }: { comment: Comment, isReply?: boolean }) => {
    const isCollapsed = collapsedComments.has(comment.id);
    const canReply = comment.level < maxNestLevel;
    const hasReplies = comment.replies.length > 0;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}
      >
        <div className={`bg-white rounded-xl p-4 ${comment.isPinned ? 'ring-2 ring-indigo-200' : ''}`}>
          {/* Comment Header */}
          <div className="flex items-start space-x-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              {comment.authorAvatar ? (
                <img 
                  src={comment.authorAvatar} 
                  alt={comment.authorName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-medium text-sm">
                  {comment.authorName.charAt(0)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900 truncate">
                  {comment.authorName}
                </span>
                {comment.authorBadge && (
                  <div className="flex-shrink-0">
                    {badgeIcons[comment.authorBadge]}
                  </div>
                )}
                {comment.isPinned && (
                  <Pin className="w-4 h-4 text-indigo-500" />
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{formatTimeAgo(comment.createdAt)}</span>
                {comment.isEdited && <span>• edited</span>}
              </div>
            </div>

            {/* Comment Actions Menu */}
            <div className="relative">
              <motion.button
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                whileTap={{ scale: 0.9 }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Comment Content */}
          <div className="mb-3">
            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 relative">
              <ReactionButton reactions={comment.reactions} commentId={comment.id} />
              
              <AnimatePresence>
                {showReactions === comment.id && (
                  <ReactionPicker commentId={comment.id} />
                )}
              </AnimatePresence>

              {canReply && (
                <motion.button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <Reply className="w-4 h-4" />
                  <span className="text-sm">Reply</span>
                </motion.button>
              )}

              <motion.button
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <Share className="w-4 h-4" />
                <span className="text-sm">Share</span>
              </motion.button>
            </div>

            {hasReplies && (
              <motion.button
                onClick={() => toggleCollapse(comment.id)}
                className="flex items-center space-x-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show {comment.replyCount} replies</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Hide replies</span>
                  </>
                )}
              </motion.button>
            )}
          </div>

          {/* Reply Form */}
          <AnimatePresence>
            {replyingTo === comment.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="flex space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium text-xs">
                      {currentUserId ? 'U' : '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                    />
                    <div className="flex justify-end space-x-2 mt-2">
                      <motion.button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        whileTap={{ scale: 0.95 }}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyContent.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        whileTap={{ scale: 0.95 }}
                      >
                        Reply
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Replies */}
        <AnimatePresence>
          {hasReplies && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4"
            >
              {comment.replies.map(reply => (
                <CommentItem key={reply.id} comment={reply} isReply />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comment Stats and Sorting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Comments ({comments.length})
          </h3>
          <MessageCircle className="w-5 h-5 text-gray-400" />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="popular">Most popular</option>
        </select>
      </div>

      {/* New Comment Form */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-sm">
              {currentUserId ? 'U' : '?'}
            </span>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <motion.button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                whileTap={{ scale: 0.95 }}
              >
                Comment
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {sortedComments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}

        {comments.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No comments yet</h4>
            <p className="text-gray-500">Be the first to share your thoughts!</p>
          </div>
        )}
      </div>
    </div>
  );
}