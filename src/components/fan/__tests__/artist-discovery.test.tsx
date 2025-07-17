import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ArtistDiscovery from '../artist-discovery';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock next/image
jest.mock('next/image', () => {
  return function MockImage({ src, alt, fill, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

const mockArtists = [
  {
    id: 'artist-1',
    displayName: 'Test Artist 1',
    bio: 'Test bio 1',
    avatar: null,
    socialLinks: null,
    createdAt: '2024-01-01T00:00:00Z',
    artistProfile: {
      totalSubscribers: 10,
      totalEarnings: '100.00',
    },
    tiers: [
      {
        id: 'tier-1',
        name: 'Basic',
        description: 'Basic tier',
        minimumPrice: '5.00',
        subscriberCount: 5,
      },
    ],
    content: [
      {
        id: 'content-1',
        title: 'Test Song',
        type: 'AUDIO',
        thumbnailUrl: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'artist-2',
    displayName: 'Test Artist 2',
    bio: 'Test bio 2',
    avatar: 'https://example.com/avatar.jpg',
    socialLinks: null,
    createdAt: '2024-01-01T00:00:00Z',
    artistProfile: {
      totalSubscribers: 5,
      totalEarnings: '50.00',
    },
    tiers: [
      {
        id: 'tier-2',
        name: 'Premium',
        description: 'Premium tier',
        minimumPrice: '10.00',
        subscriberCount: 3,
      },
    ],
    content: [],
  },
];

describe('ArtistDiscovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it('renders discovery page with header', () => {
    render(<ArtistDiscovery initialArtists={[]} />);
    
    expect(screen.getByText('Discover Artists')).toBeInTheDocument();
    expect(screen.getByText('Find and support your favorite independent artists')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search artists by name or description...')).toBeInTheDocument();
  });

  it('displays artists when provided as initial props', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);
    
    expect(screen.getByText('Test Artist 1')).toBeInTheDocument();
    expect(screen.getByText('Test Artist 2')).toBeInTheDocument();
    expect(screen.getByText('Test bio 1')).toBeInTheDocument();
    expect(screen.getByText('10 subscribers')).toBeInTheDocument();
    expect(screen.getByText('5 subscribers')).toBeInTheDocument();
  });

  it('fetches artists on initial load when no initial artists provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: mockArtists,
        pagination: { hasMore: false },
      }),
    } as Response);

    render(<ArtistDiscovery />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fan/artists?limit=20&offset=0');
    });
  });

  it('handles search form submission', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [],
          pagination: { hasMore: false },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [mockArtists[0]],
          pagination: { hasMore: false },
        }),
      } as Response);

    render(<ArtistDiscovery />);
    
    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByText('Search')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search artists by name or description...');
    const searchButton = screen.getByText('Search');
    
    fireEvent.change(searchInput, { target: { value: 'rock' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fan/artists?limit=20&offset=0&search=rock');
    });
  });

  it('navigates to artist profile when artist card is clicked', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);
    
    const artistCard = screen.getByText('Test Artist 1').closest('div[class*="cursor-pointer"]');
    fireEvent.click(artistCard!);
    
    expect(mockPush).toHaveBeenCalledWith('/artist/artist-1');
  });

  it('displays tier information correctly', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);
    
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('$5.00+/month')).toBeInTheDocument();
    expect(screen.getByText('Basic tier')).toBeInTheDocument();
    
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('$10.00+/month')).toBeInTheDocument();
    expect(screen.getByText('Premium tier')).toBeInTheDocument();
  });

  it('displays content preview when available', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);
    
    expect(screen.getByText('Recent Content:')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('audio')).toBeInTheDocument();
  });

  it('shows load more button when there are more artists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: mockArtists,
        pagination: { hasMore: true },
      }),
    } as Response);

    render(<ArtistDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Load More Artists')).toBeInTheDocument();
    });
  });

  it('loads more artists when load more button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [mockArtists[0]],
          pagination: { hasMore: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [mockArtists[1]],
          pagination: { hasMore: false },
        }),
      } as Response);

    render(<ArtistDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Load More Artists')).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByText('Load More Artists');
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fan/artists?limit=20&offset=20');
    });
  });

  it('shows empty state when no artists found', () => {
    render(<ArtistDiscovery initialArtists={[]} />);
    
    expect(screen.getByText('No artists found')).toBeInTheDocument();
    expect(screen.getByText('Check back later for new artists')).toBeInTheDocument();
  });

  it('shows search-specific empty state when search returns no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: [],
        pagination: { hasMore: false },
      }),
    } as Response);

    render(<ArtistDiscovery />);
    
    const searchInput = screen.getByPlaceholderText('Search artists by name or description...');
    const searchButton = screen.getByText('Search');
    
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ArtistDiscovery />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching artists:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('displays loading state during search', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<ArtistDiscovery initialArtists={[]} />);
    
    const searchInput = screen.getByPlaceholderText('Search artists by name or description...');
    const searchButton = screen.getByText('Search');
    
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.click(searchButton);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('displays loading state for load more', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [mockArtists[0]],
          pagination: { hasMore: true },
        }),
      } as Response)
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<ArtistDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Load More Artists')).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByText('Load More Artists');
    fireEvent.click(loadMoreButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});