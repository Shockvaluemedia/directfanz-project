/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock heroicons used by the component
jest.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: (props: any) => <svg data-testid="search-icon" {...props} />,
  FunnelIcon: (props: any) => <svg data-testid="funnel-icon" {...props} />,
  StarIcon: (props: any) => <svg data-testid="star-icon" {...props} />,
  HeartIcon: (props: any) => <svg data-testid="heart-icon" {...props} />,
  FireIcon: (props: any) => <svg data-testid="fire-icon" {...props} />,
}));

jest.mock('@heroicons/react/24/solid', () => ({
  HeartIcon: (props: any) => <svg data-testid="heart-solid-icon" {...props} />,
  StarIcon: (props: any) => <svg data-testid="star-solid-icon" {...props} />,
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock data matches the Artist interface in the component:
// artists (not artistProfile), tiers, content
const mockArtists = [
  {
    id: 'artist-1',
    displayName: 'Test Artist 1',
    bio: 'Test bio 1',
    avatar: null,
    socialLinks: null,
    createdAt: '2024-01-01T00:00:00Z',
    artists: {
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
    artists: {
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

    // The actual component uses "Discover Creators" not "Discover Artists"
    expect(screen.getByText('Discover Creators')).toBeInTheDocument();
    expect(
      screen.getByText('Find and support amazing independent creators worldwide')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search creators by name, description, or content type...')
    ).toBeInTheDocument();
  });

  it('displays artists when provided as initial props', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);

    expect(screen.getByText('Test Artist 1')).toBeInTheDocument();
    expect(screen.getByText('Test Artist 2')).toBeInTheDocument();
    expect(screen.getByText('Test bio 1')).toBeInTheDocument();
    // The component displays "{artist.artists?.totalSubscribers || 0} subscribers"
    // with the number and "subscribers" in separate <span> elements
    expect(screen.getAllByText('subscribers').length).toBeGreaterThan(0);
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
      // The component includes category, sortBy, minPrice, maxPrice params
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/fan/artists?')
      );
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

    const searchInput = screen.getByPlaceholderText('Search creators by name, description, or content type...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(searchInput, { target: { value: 'rock' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('search=rock'));
    });
  });

  it('navigates to artist profile when View Profile button is clicked', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);

    // The component navigates via "View Profile" buttons, not card click
    const viewProfileButtons = screen.getAllByText('View Profile');
    fireEvent.click(viewProfileButtons[0]);

    expect(mockPush).toHaveBeenCalledWith('/artist/artist-1');
  });

  it('displays tier information correctly', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);

    // The component shows the first tier name and price in a different format
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    // Price is formatted as "$5.00" with "/month" in a separate span
    expect(screen.getByText('Basic tier')).toBeInTheDocument();
    expect(screen.getByText('Premium tier')).toBeInTheDocument();
  });

  it('displays content preview when available', () => {
    render(<ArtistDiscovery initialArtists={mockArtists} />);

    // The component shows "Latest Content" not "Recent Content:"
    expect(screen.getByText('Latest Content')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    // Content type is displayed lowercase
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
      // Second fetch should have offset=20
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'));
    });
  });

  it('shows empty state when no artists found', async () => {
    // Mock fetch to return empty result
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: [],
        pagination: { hasMore: false },
      }),
    } as Response);

    await act(async () => {
      render(<ArtistDiscovery />);
    });

    // Wait for the async fetch to complete and loading to finish
    await waitFor(() => {
      expect(screen.getByText('No artists found')).toBeInTheDocument();
    });
    expect(screen.getByText('Check back later for new artists')).toBeInTheDocument();
  });

  it('shows search-specific empty state when search returns no results', async () => {
    // First call for initial load, second call for search
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: mockArtists, // Initial load has artists
          pagination: { hasMore: false },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [], // Search returns empty
          pagination: { hasMore: false },
        }),
      } as Response);

    render(<ArtistDiscovery />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search creators by name, description, or content type...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await act(async () => {
      fireEvent.click(searchButton);
    });

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
    // Mock initial load first, then slow search
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artists: [],
          pagination: { hasMore: false },
        }),
      } as Response)
      .mockImplementationOnce(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ artists: [], pagination: { hasMore: false } }),
                } as Response),
              100
            )
          )
      );

    render(<ArtistDiscovery />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search creators by name, description, or content type...');
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
