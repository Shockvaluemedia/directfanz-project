'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useWebSocket } from '@/components/providers/WebSocketProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageCircle,
  Heart,
  Reply,
  MoreHorizontal,
  Flag,
  Trash2,
  Edit,
  Send,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  hasLiked: boolean;
  user: {
    id: string;
    name: string;
    image?: string;
    role: string;
  };
  replies?: Comment[];
  isEditing?: boolean;
  parentId?: string;
}

interface CommentSystemProps {
  contentId: string;
  contentOwnerId: string;
  className?: string;
}

export function CommentSystem({ contentId, contentOwnerId, className }: CommentSystemProps) {
  const { data: session } = useSession();
  const { sendMessage, subscribe, isConnected } = useWebSocket();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // WebSocket event handlers
  const handleNewComment = useCallback((commentData: Comment) => {
    if (commentData.parentId) {
      // Handle reply
      setComments(prev =>
        prev.map(comment =>
          comment.id === commentData.parentId
            ? { ...comment, replies: [...(comment.replies || []), commentData] }
            : comment
        )
      );
    } else {
      // Handle top-level comment
      setComments(prev => [commentData, ...prev]);
    }

    // Scroll to show new comment
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handleCommentUpdated = useCallback(
    (updatedData: { id: string; text: string; updatedAt: string }) => {
      setComments(prev =>
        prev.map(comment => {
          if (comment.id === updatedData.id) {
            return { ...comment, text: updatedData.text, updatedAt: updatedData.updatedAt };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === updatedData.id
                  ? { ...reply, text: updatedData.text, updatedAt: updatedData.updatedAt }
                  : reply
              ),
            };
          }
          return comment;
        })
      );
    },
    []
  );

  const handleCommentDeleted = useCallback((deletedData: { id: string }) => {
    setComments(prev => {
      return prev.reduce((acc, comment) => {
        if (comment.id === deletedData.id) {
          return acc; // Remove the comment
        }

        if (comment.replies) {
          const filteredReplies = comment.replies.filter(reply => reply.id !== deletedData.id);
          return [...acc, { ...comment, replies: filteredReplies }];
        }

        return [...acc, comment];
      }, [] as Comment[]);
    });
  }, []);

  const handleLikeUpdated = useCallback(
    (likeData: { commentId: string; liked: boolean; likesCount: number }) => {
      setComments(prev =>
        prev.map(comment => {
          if (comment.id === likeData.commentId) {
            return { ...comment, hasLiked: likeData.liked, likesCount: likeData.likesCount };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === likeData.commentId
                  ? { ...reply, hasLiked: likeData.liked, likesCount: likeData.likesCount }
                  : reply
              ),
            };
          }
          return comment;
        })
      );
    },
    []
  );

  const handleUserTyping = useCallback(
    (typingData: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (typingData.isTyping && typingData.userId !== session?.user?.id) {
          newSet.add(typingData.userId);
        } else {
          newSet.delete(typingData.userId);
        }
        return newSet;
      });
    },
    [session?.user?.id]
  );

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to content updates
    sendMessage({
      type: 'subscribe_content',
      contentId,
    });

    const unsubscribeComment = subscribe('comment_added', handleNewComment);
    const unsubscribeUpdate = subscribe('comment_updated', handleCommentUpdated);
    const unsubscribeDelete = subscribe('comment_deleted', handleCommentDeleted);
    const unsubscribeLike = subscribe('like_updated', handleLikeUpdated);
    const unsubscribeTyping = subscribe('user_typing', handleUserTyping);

    return () => {
      unsubscribeComment();
      unsubscribeUpdate();
      unsubscribeDelete();
      unsubscribeLike();
      unsubscribeTyping();

      // Unsubscribe from content updates
      sendMessage({
        type: 'unsubscribe_content',
        contentId,
      });
    };
  }, [
    isConnected,
    contentId,
    sendMessage,
    subscribe,
    handleNewComment,
    handleCommentUpdated,
    handleCommentDeleted,
    handleLikeUpdated,
    handleUserTyping,
  ]);

  useEffect(() => {
    fetchComments();
  }, [contentId]);

  // Typing indicator functions
  const handleTypingStart = useCallback(() => {
    if (!isTyping && isConnected) {
      setIsTyping(true);
      sendMessage({
        type: 'typing_start',
        contentId,
        data: { userId: session?.user?.id },
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  }, [isTyping, isConnected, sendMessage, contentId, session?.user?.id]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && isConnected) {
      setIsTyping(false);
      sendMessage({
        type: 'typing_stop',
        contentId,
        data: { userId: session?.user?.id },
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, isConnected, sendMessage, contentId, session?.user?.id]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/content/${contentId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (text: string, parentId?: string) => {
    if (!session?.user || !text.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/content/${contentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          parentId,
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();

        // Stop typing indicator
        handleTypingStop();

        // Broadcast new comment via WebSocket
        if (isConnected) {
          sendMessage({
            type: 'new_comment',
            contentId,
            data: { ...newCommentData.comment, parentId },
          });
        }

        if (parentId) {
          // Add as reply
          setComments(prev =>
            prev.map(comment =>
              comment.id === parentId
                ? {
                    ...comment,
                    replies: [...(comment.replies || []), newCommentData.comment],
                  }
                : comment
            )
          );
          setReplyingTo(null);
        } else {
          // Add as top-level comment
          setComments(prev => [newCommentData.comment, ...prev]);
          setNewComment('');
        }

        // Scroll to comments section
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const updateComment = async (commentId: string, newText: string) => {
    if (!newText.trim()) return;

    try {
      const response = await fetch(`/api/content/${contentId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newText.trim() }),
      });

      if (response.ok) {
        const updatedComment = await response.json();

        // Broadcast comment update via WebSocket
        if (isConnected) {
          sendMessage({
            type: 'comment_updated',
            contentId,
            data: {
              id: commentId,
              text: updatedComment.text,
              updatedAt: updatedComment.updatedAt,
            },
          });
        }

        setComments(prev =>
          prev.map(comment => {
            if (comment.id === commentId) {
              return { ...comment, text: updatedComment.text, updatedAt: updatedComment.updatedAt };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: comment.replies.map(reply =>
                  reply.id === commentId
                    ? { ...reply, text: updatedComment.text, updatedAt: updatedComment.updatedAt }
                    : reply
                ),
              };
            }
            return comment;
          })
        );

        setEditingComment(null);
        setEditText('');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/content/${contentId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Broadcast comment deletion via WebSocket
        if (isConnected) {
          sendMessage({
            type: 'comment_deleted',
            contentId,
            data: { id: commentId },
          });
        }

        setComments(prev => {
          return prev.reduce((acc, comment) => {
            if (comment.id === commentId) {
              return acc; // Remove the comment
            }

            if (comment.replies) {
              const filteredReplies = comment.replies.filter(reply => reply.id !== commentId);
              return [...acc, { ...comment, replies: filteredReplies }];
            }

            return [...acc, comment];
          }, [] as Comment[]);
        });
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!session?.user) return;

    try {
      const comment =
        comments.find(c => c.id === commentId) ||
        comments.flatMap(c => c.replies || []).find(r => r.id === commentId);

      const method = comment?.hasLiked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/content/${contentId}/comments/${commentId}/like`, {
        method,
      });

      if (response.ok) {
        const { liked, likesCount } = await response.json();

        // Broadcast like update via WebSocket
        if (isConnected) {
          sendMessage({
            type: 'content_liked',
            contentId,
            data: {
              commentId,
              liked,
              likesCount,
            },
          });
        }

        setComments(prev =>
          prev.map(comment => {
            if (comment.id === commentId) {
              return { ...comment, hasLiked: liked, likesCount };
            }
            if (comment.replies) {
              return {
                ...comment,
                replies: comment.replies.map(reply =>
                  reply.id === commentId ? { ...reply, hasLiked: liked, likesCount } : reply
                ),
              };
            }
            return comment;
          })
        );
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const TypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    const typingCount = typingUsers.size;
    const typingText =
      typingCount === 1 ? 'Someone is typing...' : `${typingCount} people are typing...`;

    return (
      <div className='flex items-center space-x-2 text-sm text-muted-foreground py-2'>
        <div className='flex space-x-1'>
          <div
            className='w-1 h-1 bg-current rounded-full animate-bounce'
            style={{ animationDelay: '0ms' }}
          />
          <div
            className='w-1 h-1 bg-current rounded-full animate-bounce'
            style={{ animationDelay: '150ms' }}
          />
          <div
            className='w-1 h-1 bg-current rounded-full animate-bounce'
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span>{typingText}</span>
      </div>
    );
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-12' : ''}`}>
      <div className='flex space-x-3'>
        <Avatar className='w-8 h-8'>
          <AvatarImage src={comment.user.image} />
          <AvatarFallback>{comment.user.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className='flex-grow'>
          <div className='flex items-center space-x-2 mb-1'>
            <span className='font-semibold text-sm'>{comment.user.name}</span>
            {comment.user.id === contentOwnerId && (
              <Badge variant='secondary' className='text-xs'>
                Artist
              </Badge>
            )}
            {comment.user.role === 'ADMIN' && (
              <Badge variant='default' className='text-xs'>
                Admin
              </Badge>
            )}
            <span className='text-xs text-muted-foreground'>
              {formatTimeAgo(comment.createdAt)}
              {comment.updatedAt !== comment.createdAt && ' (edited)'}
            </span>
          </div>

          {editingComment === comment.id ? (
            <div className='space-y-2'>
              <Textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className='min-h-[60px]'
                placeholder='Edit your comment...'
              />
              <div className='flex space-x-2'>
                <Button
                  size='sm'
                  onClick={() => updateComment(comment.id, editText)}
                  disabled={!editText.trim()}
                >
                  Save
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setEditingComment(null);
                    setEditText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className='text-sm mb-2 whitespace-pre-wrap'>{comment.text}</p>

              <div className='flex items-center space-x-4'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => toggleLike(comment.id)}
                  className={`h-6 px-2 ${comment.hasLiked ? 'text-red-500' : ''}`}
                  disabled={!session?.user}
                >
                  <Heart className={`h-3 w-3 mr-1 ${comment.hasLiked ? 'fill-current' : ''}`} />
                  {comment.likesCount > 0 && comment.likesCount}
                </Button>

                {!isReply && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setReplyingTo(comment.id)}
                    className='h-6 px-2'
                    disabled={!session?.user}
                  >
                    <Reply className='h-3 w-3 mr-1' />
                    Reply
                  </Button>
                )}

                {(session?.user?.id === comment.user.id ||
                  session?.user?.id === contentOwnerId) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                        <MoreHorizontal className='h-3 w-3' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {session?.user?.id === comment.user.id && (
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingComment(comment.id);
                            setEditText(comment.text);
                          }}
                        >
                          <Edit className='h-3 w-3 mr-2' />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => deleteComment(comment.id)}
                        className='text-destructive'
                      >
                        <Trash2 className='h-3 w-3 mr-2' />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </>
          )}

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <div className='mt-3 space-y-2'>
              <Textarea
                placeholder='Write a reply...'
                className='min-h-[60px]'
                onChange={e => {
                  setNewComment(e.target.value);
                  if (e.target.value.length > 0) {
                    handleTypingStart();
                  } else {
                    handleTypingStop();
                  }
                }}
                onBlur={handleTypingStop}
                value={newComment}
              />
              <div className='flex space-x-2'>
                <Button
                  size='sm'
                  onClick={() => {
                    submitComment(newComment, comment.id);
                    setNewComment('');
                  }}
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting && <Loader2 className='h-3 w-3 mr-1 animate-spin' />}
                  Reply
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className='mt-4 space-y-4'>
              {comment.replies.map(reply => (
                <CommentItem key={reply.id} comment={reply} isReply={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className='h-6 w-6 animate-spin' />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center space-x-2'>
            <MessageCircle className='h-5 w-5' />
            <h3 className='font-semibold'>
              Comments {comments.length > 0 && `(${comments.length})`}
            </h3>
          </div>
          {isConnected ? (
            <div className='flex items-center space-x-1 text-xs text-green-600'>
              <div className='w-2 h-2 bg-green-500 rounded-full' />
              <span>Live</span>
            </div>
          ) : (
            <div className='flex items-center space-x-1 text-xs text-muted-foreground'>
              <div className='w-2 h-2 bg-gray-400 rounded-full' />
              <span>Connecting...</span>
            </div>
          )}
        </div>

        {/* New Comment Form */}
        {session?.user ? (
          <div className='space-y-3 mb-6'>
            <div className='flex space-x-3'>
              <Avatar className='w-8 h-8'>
                <AvatarImage src={session.user.image} />
                <AvatarFallback>{session.user.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className='flex-grow'>
                <Textarea
                  placeholder='Share your thoughts...'
                  value={newComment}
                  onChange={e => {
                    setNewComment(e.target.value);
                    if (e.target.value.length > 0) {
                      handleTypingStart();
                    } else {
                      handleTypingStop();
                    }
                  }}
                  onBlur={handleTypingStop}
                  className='min-h-[80px]'
                />
              </div>
            </div>
            <div className='flex justify-end'>
              <Button
                onClick={() => submitComment(newComment)}
                disabled={!newComment.trim() || submitting}
              >
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                <Send className='h-4 w-4 mr-2' />
                Comment
              </Button>
            </div>
          </div>
        ) : (
          <div className='text-center p-4 mb-6 bg-muted rounded-lg'>
            <p className='text-sm text-muted-foreground'>Please sign in to join the conversation</p>
          </div>
        )}

        {/* Typing Indicator */}
        <TypingIndicator />

        {/* Comments List */}
        <div className='space-y-6'>
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}

          {comments.length === 0 && (
            <div className='text-center py-8'>
              <MessageCircle className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <h4 className='font-semibold mb-2'>No comments yet</h4>
              <p className='text-sm text-muted-foreground'>
                Be the first to share your thoughts on this content!
              </p>
            </div>
          )}
        </div>

        <div ref={commentsEndRef} />
      </CardContent>
    </Card>
  );
}
