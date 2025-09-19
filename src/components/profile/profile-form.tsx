'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { UserIcon, CameraIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useApiMutation, useApi } from '@/hooks/use-api';
import { LoadingSpinner } from '@/components/ui/loading';

interface ProfileData {
  displayName: string;
  bio?: string;
  avatar?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    spotify?: string;
  };
  // Artist-specific fields
  genre?: string;
  location?: string;
  // Fan-specific fields
  favoriteGenres?: string[];
}

interface ProfileFormProps {
  initialData?: ProfileData;
  userRole: 'ARTIST' | 'FAN';
  onSuccess?: (data: any) => void;
}

const GENRES = [
  'Pop',
  'Rock',
  'Hip Hop',
  'Electronic',
  'Jazz',
  'Classical',
  'Country',
  'R&B',
  'Indie',
  'Alternative',
  'Folk',
  'Blues',
];

export default function ProfileForm({ initialData, userRole, onSuccess }: ProfileFormProps) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<ProfileData>({
    displayName: '',
    bio: '',
    website: '',
    socialLinks: {},
    favoriteGenres: [],
    ...initialData,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Update profile mutation
  const {
    loading: updating,
    mutate: updateProfile,
    error: updateError,
  } = useApiMutation<any, ProfileData>('/api/auth/profile', {
    method: 'PUT',
    onSuccess: data => {
      onSuccess?.(data);
    },
  });

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...((prev as any)[parent] || {}),
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Handle genre selection for fans
  const handleGenreToggle = (genre: string) => {
    const currentGenres = formData.favoriteGenres || [];
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];

    setFormData(prev => ({ ...prev, favoriteGenres: newGenres }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // TODO: Upload avatar if selected
      let avatarUrl = formData.avatar;
      if (avatarFile) {
        // This would typically upload to S3 or similar
        // avatarUrl = await uploadAvatar(avatarFile)
      }

      await updateProfile({
        ...formData,
        avatar: avatarUrl,
      });
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  return (
    <div className='max-w-2xl mx-auto'>
      <form onSubmit={handleSubmit} className='space-y-8'>
        {/* Avatar Section */}
        <div className='text-center'>
          <div className='relative inline-block'>
            <div className='w-32 h-32 rounded-full overflow-hidden bg-gray-100 mx-auto'>
              {avatarPreview || formData.avatar ? (
                <img
                  src={avatarPreview || formData.avatar}
                  alt='Profile'
                  className='w-full h-full object-cover'
                />
              ) : (
                <div className='w-full h-full flex items-center justify-center'>
                  <UserIcon className='w-16 h-16 text-gray-400' />
                </div>
              )}
            </div>
            <label className='absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors'>
              <CameraIcon className='w-5 h-5' />
              <input
                type='file'
                accept='image/*'
                onChange={handleAvatarChange}
                className='sr-only'
              />
            </label>
          </div>
          <p className='mt-2 text-sm text-gray-500'>
            Click the camera icon to change your profile picture
          </p>
        </div>

        {/* Basic Info */}
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>Basic Information</h3>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Display Name *</label>
              <input
                type='text'
                required
                value={formData.displayName}
                onChange={e => handleChange('displayName', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='Enter your display name'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Bio</label>
              <textarea
                rows={4}
                value={formData.bio || ''}
                onChange={e => handleChange('bio', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder={
                  userRole === 'ARTIST'
                    ? 'Tell fans about yourself and your music...'
                    : 'Tell others about your music taste and interests...'
                }
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Website</label>
              <input
                type='url'
                value={formData.website || ''}
                onChange={e => handleChange('website', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='https://'
              />
            </div>
          </div>
        </div>

        {/* Artist-specific fields */}
        {userRole === 'ARTIST' && (
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>Artist Information</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Primary Genre
                </label>
                <select
                  value={formData.genre || ''}
                  onChange={e => handleChange('genre', e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                >
                  <option value=''>Select a genre</option>
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Location</label>
                <input
                  type='text'
                  value={formData.location || ''}
                  onChange={e => handleChange('location', e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  placeholder='City, Country'
                />
              </div>
            </div>
          </div>
        )}

        {/* Fan-specific fields */}
        {userRole === 'FAN' && (
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>Music Preferences</h3>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-3'>
                Favorite Genres
              </label>
              <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                {GENRES.map(genre => {
                  const isSelected = (formData.favoriteGenres || []).includes(genre);
                  return (
                    <button
                      key={genre}
                      type='button'
                      onClick={() => handleGenreToggle(genre)}
                      className={`flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && <CheckIcon className='w-4 h-4 mr-1' />}
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Social Links */}
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>Social Links</h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Twitter</label>
              <input
                type='text'
                value={formData.socialLinks?.twitter || ''}
                onChange={e => handleChange('socialLinks.twitter', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='@username'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Instagram</label>
              <input
                type='text'
                value={formData.socialLinks?.instagram || ''}
                onChange={e => handleChange('socialLinks.instagram', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='@username'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>YouTube</label>
              <input
                type='url'
                value={formData.socialLinks?.youtube || ''}
                onChange={e => handleChange('socialLinks.youtube', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='https://youtube.com/@username'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Spotify</label>
              <input
                type='url'
                value={formData.socialLinks?.spotify || ''}
                onChange={e => handleChange('socialLinks.spotify', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='https://open.spotify.com/artist/...'
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className='flex justify-end space-x-3'>
          <button
            type='button'
            className='px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={updating}
            className='px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center'
          >
            {updating ? (
              <>
                <LoadingSpinner size='sm' color='white' />
                <span className='ml-2'>Saving...</span>
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>

        {updateError && (
          <div className='text-red-600 text-sm mt-2'>
            Failed to update profile. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
