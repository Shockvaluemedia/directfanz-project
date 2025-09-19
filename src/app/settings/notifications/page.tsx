'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TouchButton } from '@/components/ui/TouchButton';
import { TouchCard } from '@/components/ui/TouchCard';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import {
  Mail,
  Smartphone,
  Bell,
  MessageSquare,
  Shield,
  CreditCard,
  Heart,
  Megaphone,
} from 'lucide-react';
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

function ToggleSwitch({ enabled, onToggle, label, description, icon }: ToggleSwitchProps) {
  return (
    <div className='flex items-center justify-between py-3'>
      <div className='flex items-center space-x-3'>
        {icon && <div className='flex-shrink-0 text-gray-500'>{icon}</div>}
        <div>
          <h4 className='text-sm font-medium text-gray-900'>{label}</h4>
          {description && <p className='text-xs text-gray-500 mt-1'>{description}</p>}
        </div>
      </div>

      <button
        onClick={() => onToggle(!enabled)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
            transition duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch current preferences
  const fetchPreferences = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || DEFAULT_NOTIFICATION_PREFERENCES);
      }
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    if (!session?.user?.id) return;

    try {
      setSaving(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Update preference helper
  const updatePreference = (
    category: keyof NotificationPreferences,
    key: string,
    value: boolean
  ) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  // Fetch preferences on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPreferences();
    }
  }, [status, session]);

  if (status === 'loading' || loading) {
    return (
      <ResponsiveLayout>
        <div className='max-w-4xl mx-auto p-6'>
          <div className='animate-pulse'>
            <div className='h-8 bg-gray-200 rounded w-1/4 mb-6'></div>
            <div className='space-y-4'>
              <div className='h-32 bg-gray-200 rounded'></div>
              <div className='h-32 bg-gray-200 rounded'></div>
              <div className='h-32 bg-gray-200 rounded'></div>
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <ResponsiveLayout>
        <div className='max-w-4xl mx-auto p-6 text-center'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>Sign in Required</h1>
          <p className='text-gray-600'>Please sign in to manage your notification preferences.</p>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className='max-w-4xl mx-auto p-6'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>Notification Preferences</h1>
          <p className='text-gray-600'>
            Control how and when you receive notifications from Direct Fan.
          </p>
        </div>

        <div className='space-y-6'>
          {/* Email Notifications */}
          <TouchCard>
            <div className='p-6'>
              <div className='flex items-center space-x-3 mb-6'>
                <Mail className='text-indigo-600' size={24} />
                <div>
                  <h2 className='text-lg font-semibold text-gray-900'>Email Notifications</h2>
                  <p className='text-sm text-gray-600'>Receive notifications via email</p>
                </div>
              </div>

              <div className='space-y-4'>
                <ToggleSwitch
                  enabled={preferences.email.enabled}
                  onToggle={enabled => updatePreference('email', 'enabled', enabled)}
                  label='Enable Email Notifications'
                  description='Master switch for all email notifications'
                />

                {preferences.email.enabled && (
                  <div className='ml-8 space-y-3 border-l-2 border-gray-100 pl-4'>
                    <ToggleSwitch
                      enabled={preferences.email.subscriptions}
                      onToggle={enabled => updatePreference('email', 'subscriptions', enabled)}
                      label='Subscriptions'
                      description='New subscriptions and cancellations'
                      icon={<Heart size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.email.payments}
                      onToggle={enabled => updatePreference('email', 'payments', enabled)}
                      label='Payments'
                      description='Payment receipts and failures'
                      icon={<CreditCard size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.email.messages}
                      onToggle={enabled => updatePreference('email', 'messages', enabled)}
                      label='Messages'
                      description='New direct messages from fans'
                      icon={<MessageSquare size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.email.comments}
                      onToggle={enabled => updatePreference('email', 'comments', enabled)}
                      label='Comments'
                      description='Comments on your content'
                      icon={<MessageSquare size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.email.content}
                      onToggle={enabled => updatePreference('email', 'content', enabled)}
                      label='Content Updates'
                      description='Notifications about your content performance'
                    />

                    <ToggleSwitch
                      enabled={preferences.email.security}
                      onToggle={enabled => updatePreference('email', 'security', enabled)}
                      label='Security Alerts'
                      description='Important security and account notifications'
                      icon={<Shield size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.email.marketing}
                      onToggle={enabled => updatePreference('email', 'marketing', enabled)}
                      label='Marketing'
                      description='Platform updates and promotional content'
                      icon={<Megaphone size={16} />}
                    />
                  </div>
                )}
              </div>
            </div>
          </TouchCard>

          {/* Push Notifications */}
          <TouchCard>
            <div className='p-6'>
              <div className='flex items-center space-x-3 mb-6'>
                <Smartphone className='text-green-600' size={24} />
                <div>
                  <h2 className='text-lg font-semibold text-gray-900'>Push Notifications</h2>
                  <p className='text-sm text-gray-600'>Receive notifications on your devices</p>
                </div>
              </div>

              <div className='space-y-4'>
                <ToggleSwitch
                  enabled={preferences.push.enabled}
                  onToggle={enabled => updatePreference('push', 'enabled', enabled)}
                  label='Enable Push Notifications'
                  description='Master switch for all push notifications'
                />

                {preferences.push.enabled && (
                  <div className='ml-8 space-y-3 border-l-2 border-gray-100 pl-4'>
                    <ToggleSwitch
                      enabled={preferences.push.subscriptions}
                      onToggle={enabled => updatePreference('push', 'subscriptions', enabled)}
                      label='Subscriptions'
                      description='New subscriptions and cancellations'
                      icon={<Heart size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.push.payments}
                      onToggle={enabled => updatePreference('push', 'payments', enabled)}
                      label='Payments'
                      description='Payment confirmations and issues'
                      icon={<CreditCard size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.push.messages}
                      onToggle={enabled => updatePreference('push', 'messages', enabled)}
                      label='Messages'
                      description='New direct messages'
                      icon={<MessageSquare size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.push.comments}
                      onToggle={enabled => updatePreference('push', 'comments', enabled)}
                      label='Comments'
                      description='New comments on your content'
                      icon={<MessageSquare size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.push.content}
                      onToggle={enabled => updatePreference('push', 'content', enabled)}
                      label='Content Updates'
                      description='Content performance and milestones'
                    />

                    <ToggleSwitch
                      enabled={preferences.push.system}
                      onToggle={enabled => updatePreference('push', 'system', enabled)}
                      label='System Notifications'
                      description='Platform updates and announcements'
                      icon={<Bell size={16} />}
                    />
                  </div>
                )}
              </div>
            </div>
          </TouchCard>

          {/* In-App Notifications */}
          <TouchCard>
            <div className='p-6'>
              <div className='flex items-center space-x-3 mb-6'>
                <Bell className='text-blue-600' size={24} />
                <div>
                  <h2 className='text-lg font-semibold text-gray-900'>In-App Notifications</h2>
                  <p className='text-sm text-gray-600'>Show notifications within the platform</p>
                </div>
              </div>

              <div className='space-y-4'>
                <ToggleSwitch
                  enabled={preferences.inApp.enabled}
                  onToggle={enabled => updatePreference('inApp', 'enabled', enabled)}
                  label='Enable In-App Notifications'
                  description='Show notifications in the notification center'
                />

                {preferences.inApp.enabled && (
                  <div className='ml-8 space-y-3 border-l-2 border-gray-100 pl-4'>
                    <ToggleSwitch
                      enabled={preferences.inApp.all}
                      onToggle={enabled => updatePreference('inApp', 'all', enabled)}
                      label='All Notifications'
                      description='Include all notification types in the notification center'
                    />
                  </div>
                )}
              </div>
            </div>
          </TouchCard>

          {/* SMS Notifications */}
          <TouchCard>
            <div className='p-6'>
              <div className='flex items-center space-x-3 mb-6'>
                <MessageSquare className='text-purple-600' size={24} />
                <div>
                  <h2 className='text-lg font-semibold text-gray-900'>SMS Notifications</h2>
                  <p className='text-sm text-gray-600'>Receive critical notifications via SMS</p>
                </div>
              </div>

              <div className='space-y-4'>
                <ToggleSwitch
                  enabled={preferences.sms.enabled}
                  onToggle={enabled => updatePreference('sms', 'enabled', enabled)}
                  label='Enable SMS Notifications'
                  description='Master switch for SMS notifications (charges may apply)'
                />

                {preferences.sms.enabled && (
                  <div className='ml-8 space-y-3 border-l-2 border-gray-100 pl-4'>
                    <ToggleSwitch
                      enabled={preferences.sms.security}
                      onToggle={enabled => updatePreference('sms', 'security', enabled)}
                      label='Security Alerts'
                      description='Critical security notifications only'
                      icon={<Shield size={16} />}
                    />

                    <ToggleSwitch
                      enabled={preferences.sms.payments}
                      onToggle={enabled => updatePreference('sms', 'payments', enabled)}
                      label='Payment Failures'
                      description='Failed payment notifications'
                      icon={<CreditCard size={16} />}
                    />
                  </div>
                )}
              </div>
            </div>
          </TouchCard>

          {/* Save Button */}
          <div className='flex justify-end space-x-4'>
            <TouchButton
              variant='outline'
              onClick={() => setPreferences(DEFAULT_NOTIFICATION_PREFERENCES)}
            >
              Reset to Defaults
            </TouchButton>

            <TouchButton onClick={savePreferences} loading={saving} disabled={saving}>
              {saved ? 'Saved!' : 'Save Preferences'}
            </TouchButton>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
