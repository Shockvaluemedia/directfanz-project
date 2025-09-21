'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SimpleUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Redirect if not authenticated or not an artist
  React.useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin?callbackUrl=/upload-simple');
      return;
    }

    if (session.user.role !== 'ARTIST') {
      alert('Only artists can upload content');
      router.push('/');
      return;
    }
  }, [session, status, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: 'Test upload',
        isPublic: true,
        tierIds: [],
        tags: []
      }));

      const response = await fetch('/api/content/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      alert('Upload successful!');
      setFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!session || session.user.role !== 'ARTIST') {
    return null;
  }

  return (
    <div className='min-h-screen bg-gray-50 p-8'>
      <div className='max-w-2xl mx-auto bg-white rounded-lg shadow p-6'>
        <h1 className='text-2xl font-bold mb-6'>Simple Upload Test</h1>
        
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>
              Select File (Images, Audio, Video, Documents):
            </label>
            <input
              type="file"
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
              className='block w-full text-sm border border-gray-300 rounded-md p-2'
            />
          </div>

          {file && (
            <div className='bg-blue-50 p-4 rounded'>
              <p className='text-sm'>
                Selected: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className='w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        <div className='mt-6 pt-6 border-t'>
          <h2 className='text-lg font-semibold mb-2'>Debug Info:</h2>
          <div className='bg-gray-100 p-4 rounded text-sm'>
            <p><strong>User:</strong> {session?.user?.email}</p>
            <p><strong>Role:</strong> {session?.user?.role}</p>
            <p><strong>Status:</strong> {status}</p>
            <p><strong>S3 Bucket:</strong> directfanz-content-dbrooks</p>
          </div>
        </div>

        <div className='mt-4 text-center'>
          <button
            onClick={() => router.push('/dashboard')}
            className='text-blue-600 hover:underline'
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}