import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  FlatList,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  replies?: Comment[];
  isReply?: boolean;
}

interface CommentsProps {
  contentId: string;
  onCommentPress: (comment: Comment) => void;
}

const Comments: React.FC<CommentsProps> = ({
  contentId,
  onCommentPress,
}) => {
  const { theme } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
    },
    
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    commentsCount: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.medium,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sortButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
      marginRight: 4,
    },
    sortIcon: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    
    // Input Section
    inputSection: {
      marginBottom: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 44,
    },
    userAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.background,
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      paddingVertical: 8,
      maxHeight: 100,
    },
    sendButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.small,
      backgroundColor: theme.colors.primary,
      marginLeft: 8,
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.textSecondary,
    },
    sendButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'white',
    },
    replyingTo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.small,
      marginBottom: 8,
    },
    replyingToText: {
      fontSize: 13,
      color: theme.colors.primary,
    },
    cancelReply: {
      fontSize: 16,
      color: theme.colors.primary,
    },
    
    // Comments List
    commentsList: {
      flex: 1,
    },
    comment: {
      marginBottom: 16,
    },
    commentReply: {
      marginLeft: 40,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.border,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      marginRight: 10,
    },
    commentUserInfo: {
      flex: 1,
    },
    commentUserName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    commentTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    commentMoreButton: {
      padding: 4,
    },
    commentMoreIcon: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    commentContent: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
      marginBottom: 8,
    },
    commentActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    commentAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    commentActionIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    commentActionText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    commentActionActive: {
      color: theme.colors.primary,
    },
    
    // Loading and Empty States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
  });

  // Mock comments data
  React.useEffect(() => {
    setTimeout(() => {
      setComments([
        {
          id: '1',
          userId: 'user1',
          userName: 'Sarah Johnson',
          userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b2791ad0',
          content: 'This is absolutely amazing! The production quality is incredible.',
          createdAt: '2024-01-20T10:30:00Z',
          likesCount: 15,
          isLiked: false,
        },
        {
          id: '2',
          userId: 'user2',
          userName: 'Mike Chen',
          userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
          content: 'Been waiting for this! Thank you for creating such beautiful content.',
          createdAt: '2024-01-20T09:15:00Z',
          likesCount: 8,
          isLiked: true,
          replies: [
            {
              id: '2-1',
              userId: 'creator1',
              userName: 'Alex Rivera',
              userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
              content: 'Thank you so much! Your support means the world to me 🎵',
              createdAt: '2024-01-20T09:45:00Z',
              likesCount: 3,
              isLiked: false,
              isReply: true,
            },
          ],
        },
        {
          id: '3',
          userId: 'user3',
          userName: 'Emma Davis',
          userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
          content: 'The melody at 2:30 gives me chills every time! 🔥',
          createdAt: '2024-01-20T08:20:00Z',
          likesCount: 22,
          isLiked: false,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      const comment: Comment = {
        id: Date.now().toString(),
        userId: 'currentUser',
        userName: 'You',
        userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        likesCount: 0,
        isLiked: false,
      };

      if (replyingTo) {
        // Add as reply
        setComments(prev => prev.map(c => 
          c.id === replyingTo 
            ? { ...c, replies: [...(c.replies || []), { ...comment, isReply: true }] }
            : c
        ));
        setReplyingTo(null);
      } else {
        // Add as new comment
        setComments(prev => [comment, ...prev]);
      }

      setNewComment('');
      setSubmitting(false);
    }, 500);
  }, [newComment, submitting, replyingTo]);

  const handleLikeComment = useCallback((commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => prev.map(comment => 
        comment.id === parentId 
          ? {
              ...comment,
              replies: comment.replies?.map(reply => 
                reply.id === commentId 
                  ? {
                      ...reply,
                      isLiked: !reply.isLiked,
                      likesCount: reply.isLiked ? reply.likesCount - 1 : reply.likesCount + 1,
                    }
                  : reply
              )
            }
          : comment
      ));
    } else {
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likesCount: comment.isLiked ? comment.likesCount - 1 : comment.likesCount + 1,
            }
          : comment
      ));
    }
  }, []);

  const renderComment = ({ item: comment, index }: { item: Comment; index: number }) => (
    <View style={[styles.comment, comment.isReply && styles.commentReply]}>
      {/* Comment Header */}
      <View style={styles.commentHeader}>
        <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} />
        <View style={styles.commentUserInfo}>
          <Text style={styles.commentUserName}>{comment.userName}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.commentMoreButton}>
          <Text style={styles.commentMoreIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Comment Content */}
      <Text style={styles.commentContent}>{comment.content}</Text>

      {/* Comment Actions */}
      <View style={styles.commentActions}>
        <TouchableOpacity 
          style={styles.commentAction}
          onPress={() => handleLikeComment(comment.id, comment.isReply, comment.isReply ? comments.find(c => c.replies?.some(r => r.id === comment.id))?.id : undefined)}
        >
          <Text style={[
            styles.commentActionIcon,
            { color: comment.isLiked ? '#FF6B6B' : theme.colors.textSecondary }
          ]}>
            {comment.isLiked ? '❤️' : '🤍'}
          </Text>
          <Text style={[
            styles.commentActionText,
            comment.isLiked && styles.commentActionActive
          ]}>
            {comment.likesCount > 0 ? comment.likesCount : 'Like'}
          </Text>
        </TouchableOpacity>

        {!comment.isReply && (
          <TouchableOpacity 
            style={styles.commentAction}
            onPress={() => setReplyingTo(comment.id)}
          >
            <Text style={[styles.commentActionIcon, { color: theme.colors.textSecondary }]}>💬</Text>
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.commentAction}>
          <Text style={[styles.commentActionIcon, { color: theme.colors.textSecondary }]}>📤</Text>
          <Text style={styles.commentActionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={[styles.comment, styles.commentReply]}>
              <View style={styles.commentHeader}>
                <Image source={{ uri: reply.userAvatar }} style={styles.commentAvatar} />
                <View style={styles.commentUserInfo}>
                  <Text style={styles.commentUserName}>{reply.userName}</Text>
                  <Text style={styles.commentTime}>{formatTimeAgo(reply.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.commentContent}>{reply.content}</Text>
              <View style={styles.commentActions}>
                <TouchableOpacity 
                  style={styles.commentAction}
                  onPress={() => handleLikeComment(reply.id, true, comment.id)}
                >
                  <Text style={[
                    styles.commentActionIcon,
                    { color: reply.isLiked ? '#FF6B6B' : theme.colors.textSecondary }
                  ]}>
                    {reply.isLiked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={[
                    styles.commentActionText,
                    reply.isLiked && styles.commentActionActive
                  ]}>
                    {reply.likesCount > 0 ? reply.likesCount : 'Like'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.commentsCount}>
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </Text>
        <TouchableOpacity style={styles.sortButton}>
          <Text style={styles.sortButtonText}>Top</Text>
          <Text style={styles.sortIcon}>⌄</Text>
        </TouchableOpacity>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        {replyingTo && (
          <View style={styles.replyingTo}>
            <Text style={styles.replyingToText}>
              Replying to {comments.find(c => c.id === replyingTo)?.userName}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.cancelReply}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde' }}
            style={styles.userAvatar}
          />
          <TextInput
            style={styles.textInput}
            placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
            placeholderTextColor={theme.colors.textSecondary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!newComment.trim() || submitting) && styles.sendButtonDisabled
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
          >
            <Text style={styles.sendButtonText}>
              {submitting ? '...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments List */}
      {comments.length > 0 ? (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          title="No comments yet"
          message="Be the first to share your thoughts!"
          actionText="Write a comment"
          onAction={() => {
            // Focus on input
          }}
        />
      )}
    </View>
  );
};

export default Comments;