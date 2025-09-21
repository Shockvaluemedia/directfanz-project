'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  User, 
  Bell, 
  Shield, 
  Eye, 
  CreditCard, 
  Smartphone,
  Mail,
  Lock,
  Globe,
  Trash2,
  Save,
  AlertTriangle
} from 'lucide-react';

interface UserSettings {
  profile: {
    name: string;
    email: string;
    bio: string;
    isPrivate: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    marketingEmails: boolean;
    newFollowers: boolean;
    newComments: boolean;
    liveStreams: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showOnlineStatus: boolean;
    allowMessages: 'everyone' | 'followers' | 'nobody';
    showActivity: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    loginNotifications: boolean;
    sessionTimeout: number;
  };
  billing: {
    currency: 'USD' | 'EUR' | 'GBP';
    autoRenew: boolean;
    paymentMethod: string;
  };
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    loadSettings();
  }, [session, status, router]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call - in real app, this would fetch user settings
      const mockSettings: UserSettings = {
        profile: {
          name: session?.user?.name || '',
          email: session?.user?.email || '',
          bio: 'DirectFanz user passionate about exclusive content',
          isPrivate: false,
        },
        notifications: {
          emailNotifications: true,
          pushNotifications: true,
          marketingEmails: false,
          newFollowers: true,
          newComments: true,
          liveStreams: true,
        },
        privacy: {
          profileVisibility: 'public',
          showOnlineStatus: true,
          allowMessages: 'followers',
          showActivity: true,
        },
        security: {
          twoFactorEnabled: false,
          loginNotifications: true,
          sessionTimeout: 30,
        },
        billing: {
          currency: 'USD',
          autoRenew: true,
          paymentMethod: 'card-****-1234',
        },
      };

      setSettings(mockSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      // Simulate API call to save settings
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Settings saved:', settings);
      // In real app, would show success toast
    } catch (error) {
      console.error('Failed to save settings:', error);
      // In real app, would show error toast
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (section: keyof UserSettings, field: string, value: any) => {
    if (!settings) return;

    setSettings(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [field]: value,
      },
    }));
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!session || !settings) {
    return null;
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const renderProfileSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information and bio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={settings.profile.name}
            onChange={(e) => updateSettings('profile', 'name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            value={settings.profile.email}
            onChange={(e) => updateSettings('profile', 'email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            value={settings.profile.bio}
            onChange={(e) => updateSettings('profile', 'bio', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell others about yourself..."
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="private-profile"
            checked={settings.profile.isPrivate}
            onChange={(e) => updateSettings('profile', 'isPrivate', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="private-profile" className="ml-2 block text-sm text-gray-900">
            Make my profile private
          </label>
        </div>
      </CardContent>
    </Card>
  );

  const renderNotificationSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose how you'd like to be notified</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(settings.notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            </div>
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => updateSettings('notifications', key, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderPrivacySettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Settings</CardTitle>
        <CardDescription>Control who can see your information and activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Profile Visibility</label>
          <select
            value={settings.privacy.profileVisibility}
            onChange={(e) => updateSettings('privacy', 'profileVisibility', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="public">Public</option>
            <option value="followers">Followers Only</option>
            <option value="private">Private</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allow Messages From</label>
          <select
            value={settings.privacy.allowMessages}
            onChange={(e) => updateSettings('privacy', 'allowMessages', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers Only</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-900">Show Online Status</label>
          <input
            type="checkbox"
            checked={settings.privacy.showOnlineStatus}
            onChange={(e) => updateSettings('privacy', 'showOnlineStatus', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-900">Show Activity Status</label>
          <input
            type="checkbox"
            checked={settings.privacy.showActivity}
            onChange={(e) => updateSettings('privacy', 'showActivity', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderSecuritySettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>Keep your account secure</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium">Two-Factor Authentication</p>
            <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
          </div>
          <Button
            variant={settings.security.twoFactorEnabled ? "destructive" : "default"}
            size="sm"
            onClick={() => updateSettings('security', 'twoFactorEnabled', !settings.security.twoFactorEnabled)}
          >
            {settings.security.twoFactorEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-900">Login Notifications</label>
          <input
            type="checkbox"
            checked={settings.security.loginNotifications}
            onChange={(e) => updateSettings('security', 'loginNotifications', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session Timeout (minutes)
          </label>
          <select
            value={settings.security.sessionTimeout}
            onChange={(e) => updateSettings('security', 'sessionTimeout', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );

  const renderBillingSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Payments</CardTitle>
        <CardDescription>Manage your payment methods and billing preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
          <select
            value={settings.billing.currency}
            onChange={(e) => updateSettings('billing', 'currency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-900">Auto-renew subscriptions</label>
          <input
            type="checkbox"
            checked={settings.billing.autoRenew}
            onChange={(e) => updateSettings('billing', 'autoRenew', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="font-medium mb-2">Default Payment Method</p>
          <p className="text-sm text-gray-600">{settings.billing.paymentMethod}</p>
          <Button variant="outline" size="sm" className="mt-2">
            Update Payment Method
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileSettings();
      case 'notifications': return renderNotificationSettings();
      case 'privacy': return renderPrivacySettings();
      case 'security': return renderSecuritySettings();
      case 'billing': return renderBillingSettings();
      default: return renderProfileSettings();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and settings</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <IconComponent className="w-5 h-5 mr-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderTabContent()}
          
          {/* Save Button */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center"
            >
              {isSaving ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>

            <div className="text-sm text-gray-500">
              All changes are saved automatically
            </div>
          </div>

          {/* Danger Zone */}
          <Card className="mt-8 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are permanent and cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}