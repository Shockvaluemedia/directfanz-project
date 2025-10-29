'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { User, Edit, Mail, Calendar, Settings, Shield } from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: 'ARTIST' | 'FAN';
  createdAt: string;
  avatar?: string;
  bio?: string;
  totalContent?: number;
  totalSubscriptions?: number;
  totalFollowers?: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // Load profile data
    loadProfileData();
  }, [session, status, router]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      // In a real app, this would be an API call
      // For now, we'll use session data and simulate additional data
      const data: ProfileData = {
        id: session?.user?.id || 'user-id',
        name: session?.user?.name || 'User',
        email: session?.user?.email || '',
        role: (session?.user as any)?.role || 'FAN',
        createdAt: '2024-01-01T00:00:00.000Z',
        bio: 'Welcome to my DirectFanz profile!',
        totalContent: Math.floor(Math.random() * 50),
        totalSubscriptions: Math.floor(Math.random() * 20),
        totalFollowers: Math.floor(Math.random() * 100),
      };
      setProfileData(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!session || !profileData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleEditProfile = () => {
    setIsEditing(true);
    // In a real app, this would open a modal or navigate to edit form
    console.log('Edit profile clicked');
  };

  const getRoleBadge = (role: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    if (role === 'ARTIST') {
      return `${baseClasses} bg-purple-100 text-purple-800`;
    }
    return `${baseClasses} bg-blue-100 text-blue-800`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
        <p className="text-gray-600">Manage your account information and preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{profileData.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4" />
                      {profileData.email}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleEditProfile} variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <span className={getRoleBadge(profileData.role)}>
                    {profileData.role}
                  </span>
                </div>
                
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Member since {formatDate(profileData.createdAt)}
                </div>

                {profileData.bio && (
                  <div>
                    <h3 className="font-semibold mb-2">Bio</h3>
                    <p className="text-gray-700">{profileData.bio}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profileData.role === 'ARTIST' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Content Created</span>
                      <span className="font-semibold">{profileData.totalContent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Followers</span>
                      <span className="font-semibold">{profileData.totalFollowers}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subscriptions</span>
                      <span className="font-semibold">{profileData.totalSubscriptions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Following</span>
                      <span className="font-semibold">{profileData.totalFollowers}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/settings')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Account Settings
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => router.push('/settings')}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Settings
                </Button>
                {profileData.role === 'ARTIST' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => router.push('/studio')}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Content Studio
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest actions on DirectFanz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <p>No recent activity to display</p>
            <p className="text-sm mt-2">Start exploring to see your activity here!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}