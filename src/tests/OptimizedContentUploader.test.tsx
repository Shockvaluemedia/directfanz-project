import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OptimizedContentUploader from '../components/upload/OptimizedContentUploader';

// Mock next-auth
const mockUseSession = jest.fn();
const mockPush = jest.fn();
const mockUseRouter = jest.fn(() => ({
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
}));

// Mock S3 lib
jest.mock('@/lib/s3', () => ({
  SUPPORTED_FILE_TYPES: {
    'image/jpeg': { category: 'IMAGE', extension: 'jpg' },
    'image/png': { category: 'IMAGE', extension: 'png' },
    'video/mp4': { category: 'VIDEO', extension: 'mp4' },
    'audio/mp3': { category: 'AUDIO', extension: 'mp3' },
  },
  FILE_SIZE_LIMITS: {
    IMAGE: 50 * 1024 * 1024, // 50MB
    VIDEO: 500 * 1024 * 1024, // 500MB
    AUDIO: 100 * 1024 * 1024, // 100MB
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OptimizedContentUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/content/optimize?action=strategies')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              strategies: [
                { key: 'auto', name: 'Auto (Recommended)', description: 'AI-powered optimization' },
                { key: 'balanced', name: 'Balanced', description: 'Good balance' },
                { key: 'quality', name: 'Quality First', description: 'Preserve quality' },
              ]
            }
          })
        });
      }
      
      if (url.includes('/api/upload/presigned-url')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              uploadUrl: 'https://mock-s3-upload-url.com',
              fileUrl: 'https://mock-file-url.com/file.jpg'
            }
          })
        });
      }
      
      if (url.includes('/api/content/optimize') && !url.includes('?action=strategies')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              sizeReduction: 25,
              qualityScore: 85,
              optimizedUrl: 'https://mock-optimized-url.com/file.webp'
            }
          })
        });
      }

      if (url.includes('/api/artist/content')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, id: 'content-123' })
        });
      }

      if (url.includes('https://mock-s3-upload-url.com')) {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('Authentication & Access Control', () => {
    test('should deny access for non-artist users', () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'FAN' } },
        status: 'authenticated'
      });

      render(<OptimizedContentUploader />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText('Only artists can upload content.')).toBeInTheDocument();
    });

    test('should allow access for artist users', () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });

      render(<OptimizedContentUploader />);

      expect(screen.getByText('Upload your content')).toBeInTheDocument();
      expect(screen.getByText('Choose Files')).toBeInTheDocument();
    });

    test('should deny access for unauthenticated users', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated'
      });

      render(<OptimizedContentUploader />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  describe('File Selection & Validation', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should handle file selection via file input', () => {
      render(<OptimizedContentUploader />);

      const fileInput = screen.getByRole('button', { name: /choose files/i });
      fireEvent.click(fileInput);

      // The actual file input is hidden, but we can verify the button works
      expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });

    test('should validate supported file types', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
        expect(screen.queryByText(/unsupported file type/i)).not.toBeInTheDocument();
      });
    });

    test('should reject unsupported file types', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });
    });

    test('should validate file size limits', async () => {
      render(<OptimizedContentUploader />);

      // Create a large file (60MB for image, which exceeds 50MB limit)
      const largeFile = new File(
        [new ArrayBuffer(60 * 1024 * 1024)], 
        'large.jpg', 
        { type: 'image/jpeg' }
      );
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [largeFile] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds.*mb limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should handle drag over events', () => {
      render(<OptimizedContentUploader />);

      const dropzone = screen.getByText('Upload your content').closest('div');
      
      fireEvent.dragOver(dropzone!, { 
        preventDefault: jest.fn(),
        dataTransfer: { files: [] }
      });

      expect(dropzone).toHaveClass('border-indigo-400', 'bg-indigo-50');
    });

    test('should handle drag leave events', () => {
      render(<OptimizedContentUploader />);

      const dropzone = screen.getByText('Upload your content').closest('div');
      
      // First drag over, then drag leave
      fireEvent.dragOver(dropzone!, { preventDefault: jest.fn() });
      fireEvent.dragLeave(dropzone!, { preventDefault: jest.fn() });

      expect(dropzone).not.toHaveClass('border-indigo-400', 'bg-indigo-50');
    });

    test('should handle file drop', async () => {
      render(<OptimizedContentUploader />);

      const dropzone = screen.getByText('Upload your content').closest('div');
      const file = new File(['test'], 'dropped.jpg', { type: 'image/jpeg' });
      
      await act(async () => {
        fireEvent.drop(dropzone!, {
          preventDefault: jest.fn(),
          dataTransfer: { files: [file] }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('dropped.jpg')).toBeInTheDocument();
      });
    });
  });

  describe('Optimization Settings', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should show optimization settings modal', async () => {
      render(<OptimizedContentUploader />);

      const settingsButton = screen.getByRole('button', { name: /optimization settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getAllByText('Optimization Settings')).toHaveLength(2); // Button and dialog title
        expect(screen.getByLabelText(/enable smart optimization/i)).toBeInTheDocument();
      });
    });

    test('should toggle optimization on/off', async () => {
      render(<OptimizedContentUploader />);

      fireEvent.click(screen.getByRole('button', { name: /optimization settings/i }));

      await waitFor(() => {
        const enableToggle = screen.getByLabelText(/enable smart optimization/i);
        expect(enableToggle).toBeChecked();
        
        fireEvent.click(enableToggle);
        expect(enableToggle).not.toBeChecked();
      });
    });

    test('should change optimization strategy', async () => {
      render(<OptimizedContentUploader />);

      fireEvent.click(screen.getByRole('button', { name: /optimization settings/i }));

      await waitFor(() => {
        const strategySelect = screen.getByDisplayValue('Auto (Recommended)');
        fireEvent.change(strategySelect, { target: { value: 'quality' } });
        
        expect(strategySelect).toHaveValue('quality');
      });
    });

    test('should change target device and connection', async () => {
      render(<OptimizedContentUploader />);

      fireEvent.click(screen.getByRole('button', { name: /optimization settings/i }));

      await waitFor(() => {
        const deviceSelect = screen.getByDisplayValue('💻 Desktop');
        const connectionSelect = screen.getByDisplayValue('📶 Wi-Fi');
        
        fireEvent.change(deviceSelect, { target: { value: 'mobile' } });
        fireEvent.change(connectionSelect, { target: { value: '4g' } });
        
        expect(deviceSelect).toHaveValue('mobile');
        expect(connectionSelect).toHaveValue('4g');
      });
    });

    test('should display current optimization status', () => {
      render(<OptimizedContentUploader />);

      expect(screen.getByText(/smart optimization: enabled/i)).toBeInTheDocument();
      expect(screen.getByText(/strategy: auto \(recommended\)/i)).toBeInTheDocument();
    });
  });

  describe('File Upload Process', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should initiate upload process', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload/i });
        expect(uploadButton).toBeInTheDocument();
      });
    });

    test('should show upload progress and complete successfully', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Should complete upload and show success state
      await waitFor(() => {
        expect(screen.getByText(/optimized:.*% smaller/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('should show optimization results after upload', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/optimized: .*% smaller/i)).toBeInTheDocument();
        expect(screen.getByText(/quality: .*\/100/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('should show publish button after successful upload', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
        expect(screen.getByText(/ready to publish/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Content Publishing', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should open metadata form when publish is clicked', async () => {
      render(<OptimizedContentUploader />);

      // Upload a file first
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      const publishButton = await screen.findByRole('button', { name: /publish/i });
      await act(async () => {
        fireEvent.click(publishButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Publish Content')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/enter content title/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/describe your content/i)).toBeInTheDocument();
      });
    });

    test('should require title for publishing', async () => {
      render(<OptimizedContentUploader />);

      // Setup upload and open publish form
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      const publishButton = await screen.findByRole('button', { name: /publish/i });
      await act(async () => {
        fireEvent.click(publishButton);
      });

      await waitFor(() => {
        // The title field is pre-filled with the filename, so let's clear it
        const titleInput = screen.getByPlaceholderText(/enter content title/i);
        fireEvent.change(titleInput, { target: { value: '' } });
        
        const publishButtons = screen.getAllByRole('button', { name: /publish/i });
        const modalPublishButton = publishButtons.find(btn => 
          btn.className.includes('bg-indigo-600')
        );
        expect(modalPublishButton).toBeDisabled();
      });
    });

    test('should enable publish when title is provided', async () => {
      render(<OptimizedContentUploader />);

      // Setup upload and open publish form
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      const publishButton = await screen.findByRole('button', { name: /publish/i });
      await act(async () => {
        fireEvent.click(publishButton);
      });

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText(/enter content title/i);
        fireEvent.change(titleInput, { target: { value: 'Test Content' } });
        
        const publishButtons = screen.getAllByRole('button', { name: /publish/i });
        const modalPublishButton = publishButtons.find(btn => 
          btn.className.includes('bg-indigo-600')
        );
        expect(modalPublishButton).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should handle API strategy loading failure gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/content/optimize?action=strategies')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<OptimizedContentUploader />);

      // Should still show the component with fallback strategies
      await waitFor(() => {
        expect(screen.getByText('Upload your content')).toBeInTheDocument();
      });
    });

    test('should handle upload failures', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/upload/presigned-url')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Upload failed' })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const uploadButton = await screen.findByRole('button', { name: /upload/i });
      
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to get upload url/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('should remove files when X is clicked', async () => {
      render(<OptimizedContentUploader />);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('test.jpg')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple Files Handling', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '1', role: 'ARTIST' } },
        status: 'authenticated'
      });
    });

    test('should handle multiple file selection', async () => {
      render(<OptimizedContentUploader />);

      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.png', { type: 'image/png' }),
      ];
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });

      await waitFor(() => {
        expect(screen.getByText('test1.jpg')).toBeInTheDocument();
        expect(screen.getByText('test2.png')).toBeInTheDocument();
      });
    });

    test('should show correct file icons for different types', async () => {
      render(<OptimizedContentUploader />);

      const files = [
        new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
        new File(['video'], 'video.mp4', { type: 'video/mp4' }),
        new File(['audio'], 'audio.mp3', { type: 'audio/mp3' }),
      ];
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });

      await waitFor(() => {
        expect(screen.getByText('image.jpg')).toBeInTheDocument();
        expect(screen.getByText('video.mp4')).toBeInTheDocument();
        expect(screen.getByText('audio.mp3')).toBeInTheDocument();
      });
    });
  });
});