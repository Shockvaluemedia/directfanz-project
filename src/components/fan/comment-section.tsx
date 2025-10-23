import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CommentWithUser {
  id: string;
  contentId: string;
  fanId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  fan: {
    id: string;
    displayName: string;
    avatar?: string;
  };
}

interface CommentSectionProps {
  contentId: string;
}

export default function CommentSection({ contentId }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/fan/comments?contentId=${contentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch comments');
        }
        const data = await response.json();
        setComments(data.comments);
      } catch (err) {
        setError('Failed to load comments');
        console.error(err);
      }
    };

    fetchComments();
  }, [contentId]);

  // Submit new comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fan/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          text: newComment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const data = await response.json();

      // Add the new comment to the list
      setComments([...comments, data.comment]);
      setNewComment('');
    } catch (err) {
      setError('Failed to post comment');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/fan/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove the deleted comment from the list
      setComments(comments.filter(comment => comment.id !== commentId));
    } catch (err) {
      setError('Failed to delete comment');
      console.error(err);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className='mt-8 space-y-6'>
      <h2 className='text-2xl font-bold'>Comments</h2>

      {/* Comment form */}
      {session ? (
        <form onSubmit={handleSubmitComment} className='space-y-4'>
          <div>
            <textarea
              className='w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              rows={3}
              placeholder='Add a comment...'
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {error && <p className='text-red-500'>{error}</p>}
          <Button type='submit' disabled={isLoading || !newComment.trim()}>
            {isLoading ? 'Posting...' : 'Post Comment'}
          </Button>
        </form>
      ) : (
        <p className='text-gray-500'>Please sign in to leave a comment.</p>
      )}

      {/* Comments list */}
      <div className='space-y-4'>
        {comments.length === 0 ? (
          <p className='text-gray-500'>No comments yet. Be the first to comment!</p>
        ) : (
          comments.map(comment => (
            <Card key={comment.id} className='p-4'>
              <div className='flex items-start space-x-4'>
                <div className='flex-shrink-0'>
                  {comment.fan.avatar ? (
                    <img
                      src={comment.fan.avatar}
                      alt={comment.fan.displayName}
                      className='w-10 h-10 rounded-full'
                    />
                  ) : (
                    <div className='w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center'>
                      <span className='text-gray-500 font-medium'>
                        {comment.fan.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className='flex-grow'>
                  <div className='flex justify-between items-start'>
                    <div>
                      <h4 className='font-medium'>{comment.fan.displayName}</h4>
                      <p className='text-sm text-gray-500'>
                        {formatDate(comment.createdAt.toString())}
                      </p>
                    </div>
                    {session?.user?.id === comment.fan.id && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleDeleteComment(comment.id)}
                        className='text-red-500 hover:text-red-700'
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                  <p className='mt-2'>{comment.text}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
