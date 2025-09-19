import { render, screen, waitFor, act } from '@testing-library/react';
import ContentPlayer from '../content-player';

// Mock the MediaPlaylist component
jest.mock('@/components/ui/media-playlist', () => {
  return function MockMediaPlaylist({ items }: any) {
    return (
      <div data-testid='media-playlist'>
        <div>Media Playlist</div>
        <div>Items: {items.length}</div>
        {items.map((item: any) => (
          <div key={item.id} data-testid={`media-item-${item.id}`}>
            <div>Title: {item.title}</div>
            <div>Type: {item.type}</div>
            <div>URL: {item.url}</div>
          </div>
        ))}
      </div>
    );
  };
});

// Mock content data
const mockAudioContent = {
  id: 'audio-1',
  title: 'Test Audio',
  artistName: 'Test Artist',
  type: 'AUDIO',
  fileUrl: 'https://example.com/audio.mp3',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  metadata: { duration: 180 },
};

const mockVideoContent = {
  id: 'video-1',
  title: 'Test Video',
  artistName: 'Test Artist',
  type: 'VIDEO',
  fileUrl: 'https://example.com/video.mp4',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  metadata: { duration: 300 },
};

describe('ContentPlayer', () => {
  it('renders loading state initially', async () => {
    // Render the component
    render(<ContentPlayer content={mockAudioContent} />);

    // Should show loading spinner initially before async operations complete
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Wait for async operations to complete to avoid act warnings
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  it('renders media playlist with single content item', async () => {
    await act(async () => {
      render(<ContentPlayer content={mockAudioContent} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('media-playlist')).toBeInTheDocument();
      expect(screen.getByTestId(`media-item-${mockAudioContent.id}`)).toBeInTheDocument();
      expect(screen.getByText(`Title: ${mockAudioContent.title}`)).toBeInTheDocument();
      expect(screen.getByText(`Type: ${mockAudioContent.type}`)).toBeInTheDocument();
      expect(
        screen.getByText(`URL: /api/content/${mockAudioContent.id}/stream`)
      ).toBeInTheDocument();
    });
  });

  it('renders media playlist with multiple content items', async () => {
    const contentArray = [mockAudioContent, mockVideoContent];
    await act(async () => {
      render(<ContentPlayer content={contentArray} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('media-playlist')).toBeInTheDocument();
      expect(screen.getByText('Items: 2')).toBeInTheDocument();
      expect(screen.getByTestId(`media-item-${mockAudioContent.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`media-item-${mockVideoContent.id}`)).toBeInTheDocument();
    });
  });

  it('handles content with missing metadata', async () => {
    const contentWithoutMetadata = {
      ...mockAudioContent,
      metadata: null,
    };

    await act(async () => {
      render(<ContentPlayer content={contentWithoutMetadata} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('media-playlist')).toBeInTheDocument();
    });
  });

  it('handles content with missing artist name', async () => {
    const contentWithoutArtist = {
      ...mockAudioContent,
      artistName: null,
    };

    await act(async () => {
      render(<ContentPlayer content={contentWithoutArtist} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('media-playlist')).toBeInTheDocument();
    });
  });
});
