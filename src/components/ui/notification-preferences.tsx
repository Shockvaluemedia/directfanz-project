import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NotificationPreferences } from '@/lib/notifications';

export default function NotificationPreferencesComponent() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newContent: true,
    comments: true,
    subscriptionUpdates: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch user's notification preferences
  useEffect(() => {
    if (!session?.user) return;

    const fetchPreferences = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/user/notifications/preferences');
        if (!response.ok) {
          throw new Error('Failed to fetch notification preferences');
        }
        const data = await response.json();
        setPreferences(data.preferences);
      } catch (err) {
        setError('Failed to load notification preferences');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [session]);

  // Save notification preferences
  const handleSavePreferences = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/user/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }

      setSuccessMessage('Notification preferences saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError('Failed to save notification preferences');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (key: keyof NotificationPreferences) => {
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  if (isLoading) {
    return <div className='text-center py-4'>Loading preferences...</div>;
  }

  return (
    <Card className='p-6'>
      <h2 className='text-xl font-bold mb-4'>Notification Preferences</h2>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='font-medium'>New Content Notifications</h3>
            <p className='text-sm text-gray-500'>
              Receive notifications when artists you subscribe to post new content
            </p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              className='sr-only peer'
              checked={preferences.newContent}
              onChange={() => handleCheckboxChange('newContent')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h3 className='font-medium'>Comment Notifications</h3>
            <p className='text-sm text-gray-500'>
              Receive notifications when someone comments on your content
            </p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              className='sr-only peer'
              checked={preferences.comments}
              onChange={() => handleCheckboxChange('comments')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h3 className='font-medium'>Subscription Updates</h3>
            <p className='text-sm text-gray-500'>
              Receive notifications about your subscription status and payments
            </p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              className='sr-only peer'
              checked={preferences.subscriptionUpdates}
              onChange={() => handleCheckboxChange('subscriptionUpdates')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {error && <div className='mt-4 p-3 bg-red-100 text-red-700 rounded-md'>{error}</div>}

      {successMessage && (
        <div className='mt-4 p-3 bg-green-100 text-green-700 rounded-md'>{successMessage}</div>
      )}

      <div className='mt-6'>
        <Button onClick={handleSavePreferences} disabled={isSaving} className='w-full'>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </Card>
  );
}
