'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestUploadPage() {
  const { data: session, status } = useSession();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Generate and set CSRF token on component mount
  React.useEffect(() => {
    // Check if CSRF token already exists in cookie
    const existingToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1];

    if (existingToken) {
      setCsrfToken(existingToken);
      console.log('Using existing CSRF token');
    } else {
      // Generate a new CSRF token
      const newToken = crypto.randomUUID();
      // Set it as a cookie
      document.cookie = `csrf-token=${newToken}; path=/; SameSite=Lax`;
      setCsrfToken(newToken);
      console.log('Generated new CSRF token');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setResult('❌ Please select a file first');
      return;
    }

    if (status !== 'authenticated' || !session) {
      setResult('❌ You must be signed in to upload files');
      return;
    }

    // Check file size - Vercel has 6MB limit for serverless functions
    const maxSize = 4 * 1024 * 1024; // 4MB to be safe
    if (file.size > maxSize) {
      setResult(`❌ File too large (${Math.round(file.size / 1024 / 1024)}MB). Please use a file smaller than 4MB, or we'll need to implement presigned URLs for larger files.`);
      return;
    }

    setUploading(true);
    setResult('🔄 Uploading...');

    try {
      console.log('CSRF Token:', csrfToken ? 'Found' : 'Not found');
      console.log('Session:', session.user ? 'Authenticated' : 'Not authenticated');
      console.log('User Role:', session.user?.role);
      console.log('File Size:', `${Math.round(file.size / 1024 / 1024 * 100) / 100}MB`);
      console.log('Full Session:', session);
      console.log('All Cookies:', document.cookie);
      
      // Check for NextAuth cookies specifically
      const allCookies = document.cookie.split(';').map(c => c.trim());
      const nextAuthCookies = allCookies.filter(c => c.includes('next-auth'));
      console.log('NextAuth Cookies Found:', nextAuthCookies.length, nextAuthCookies);
      
      if (nextAuthCookies.length === 0) {
        console.warn('WARNING: No NextAuth session cookies found! Testing server session...');
        
        // Test server session
        try {
          const sessionResponse = await fetch('/api/test-session', {
            method: 'GET',
            credentials: 'include',
          });
          const sessionData = await sessionResponse.json();
          console.log('Server session test:', sessionData);
          
          if (!sessionData.debug.hasSession) {
            setResult('❌ No server-side session found. Please sign out completely and sign back in.');
            return;
          } else {
            console.log('Server session exists, but NextAuth cookies missing. Continuing with upload...');
          }
        } catch (error) {
          console.error('Server session test failed:', error);
          setResult('❌ Session test failed. Please try signing out and back in.');
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: 'Test upload from simple page',
        isPublic: true,
        tierIds: [],
        tags: ['test']
      }));

      console.log('Uploading file:', file.name);
      
      const headers: HeadersInit = {
        // NextAuth automatically includes cookies for session
        'credentials': 'include',
      };
      
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      const response = await fetch('/api/simple-upload', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies (NextAuth session)
        body: formData,
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      setResult(`✅ Upload successful! File ID: ${result.id || 'unknown'}`);
      setFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setResult(`❌ Upload failed: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className='min-h-screen bg-gray-50 p-8 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 p-8'>
      <div className='max-w-2xl mx-auto bg-white rounded-lg shadow p-6'>
        <h1 className='text-2xl font-bold mb-6 text-gray-900'>Direct S3 Upload Test</h1>
        
        <div className='space-y-6'>
          <div className='bg-blue-50 p-4 rounded-lg'>
            <h2 className='font-semibold text-blue-900 mb-2'>🧪 Test Your S3 Upload</h2>
            <p className='text-blue-800 text-sm'>
              This page bypasses complex authentication and directly tests the S3 upload API.
            </p>
          </div>
          
          <div>
            <label className='block text-sm font-medium mb-2 text-gray-700'>
              Select a file to upload:
            </label>
            <input
              type="file"
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
              className='block w-full text-sm border border-gray-300 rounded-md p-3 bg-white'
            />
          </div>

          {file && (
            <div className='bg-green-50 p-4 rounded-lg border border-green-200'>
              <h3 className='font-semibold text-green-900 mb-2'>📁 Selected File:</h3>
              <div className='text-sm text-green-800'>
                <p><strong>Name:</strong> {file.name}</p>
                <p><strong>Size:</strong> {Math.round(file.size / 1024)} KB</p>
                <p><strong>Type:</strong> {file.type || 'Unknown'}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className='w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium'
          >
            {uploading ? '⏳ Uploading...' : '🚀 Upload to S3'}
          </button>

          {result && (
            <div className={`p-4 rounded-lg ${result.includes('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${result.includes('✅') ? 'text-green-800' : 'text-red-800'}`}>
                {result}
              </p>
            </div>
          )}

          <div className='bg-gray-50 p-4 rounded-lg'>
            <h3 className='font-semibold text-gray-900 mb-2'>🔧 Debug Info:</h3>
            <div className='text-sm text-gray-600 space-y-1'>
              <p><strong>S3 Bucket:</strong> directfanz-content-dbrooks</p>
              <p><strong>Region:</strong> us-east-2</p>
              <p><strong>Upload API:</strong> /api/simple-upload</p>
              <p><strong>Status:</strong> {uploading ? 'Uploading' : 'Ready'}</p>
              <p><strong>CSRF Token:</strong> {csrfToken ? '✅ Set' : '❌ Missing'}</p>
              <p><strong>Auth Status:</strong> {status}</p>
              <p><strong>User Role:</strong> {session?.user?.role || 'None'}</p>
              <p><strong>User Email:</strong> {session?.user?.email || 'None'}</p>
            </div>
          </div>

          <div className='border-t pt-4'>
            <div className='flex space-x-4'>
              <a 
                href="/dashboard" 
                className='bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700'
              >
                Back to Dashboard
              </a>
              <a 
                href="/auth-debug" 
                className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
              >
                Check Auth Status
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}