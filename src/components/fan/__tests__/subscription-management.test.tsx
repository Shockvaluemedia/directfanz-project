import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SubscriptionManagement from '../subscription-management';

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

// Mock window.confirm and alert
global.confirm = jest.fn();
global.alert = jest.fn();

const mockSubscriptions = [
  {
    id: 'sub-1',
    amount: '10.00',
    status: 'ACTIVE',
    currentPeriodStart: '2024-01-01T00:00:00Z',
    currentPeriodEnd: '2024-02-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    tier: {
      id: 'tier-1',
      name: 'Basic',
      description: 'Basic tier with exclusive content',
      minimumPrice: '5.00',
      artist: {
        id: 'artist-1',
        displayName: 'Test Artist',
        avatar: 'https://example.com/avatar.jpg',
      },
    },
  },
  {
    id: 'sub-2',
    amount: '25.00',
    status: 'CANCELED',
    currentPeriodStart: '2024-01-01T00:00:00Z',
    currentPeriodEnd: '2024-02-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    tier: {
      id: 'tier-2',
      name: 'Premium',
      description: 'Premium tier with extra perks',
      minimumPrice: '15.00',
      artist: {
        id: 'artist-2',
        displayName: 'Another Artist',
        avatar: null,
      },
    },
  },
];

describe('SubscriptionManagement', () => {
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

  it('renders loading state initially', () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    
    render(<SubscriptionManagement />);
    
    expect(screen.getByText('Loading your subscriptions...')).toBeInTheDocument();
  });

  it('fetches and displays subscriptions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Your Subscriptions')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('$10.00/month')).toBeInTheDocument();
    expect(screen.getByText('Another Artist')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('$25.00/month')).toBeInTheDocument();
  });

  it('shows empty state when no subscriptions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: [] }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('No subscriptions yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Start supporting your favorite artists by subscribing to their tiers')).toBeInTheDocument();
    expect(screen.getByText('Discover Artists')).toBeInTheDocument();
  });

  it('navigates to discover page from empty state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: [] }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Discover Artists')).toBeInTheDocument();
    });

    const discoverButton = screen.getByText('Discover Artists');
    fireEvent.click(discoverButton);

    expect(mockPush).toHaveBeenCalledWith('/discover');
  });

  it('displays subscription status correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('canceled')).toBeInTheDocument();
    });
  });

  it('allows editing subscription amount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    expect(screen.getByDisplayValue('10.00')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('updates subscription amount successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriptions: mockSubscriptions }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Subscription updated successfully' }),
      } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    const amountInput = screen.getByDisplayValue('10.00');
    fireEvent.change(amountInput, { target: { value: '20' } });

    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fan/subscriptions/sub-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 20 }),
      });
    });

    expect(global.alert).toHaveBeenCalledWith('Subscription amount updated successfully!');
  });

  it('validates minimum amount when updating', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    const amountInput = screen.getByDisplayValue('10.00');
    fireEvent.change(amountInput, { target: { value: '3' } });

    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    expect(global.alert).toHaveBeenCalledWith('Amount must be at least $5.00');
  });

  it('handles update errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriptions: mockSubscriptions }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Update failed');
    });
  });

  it('cancels editing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.getByText('Change Amount')).toBeInTheDocument();
  });

  it('cancels subscription with confirmation', async () => {
    (global.confirm as jest.Mock).mockReturnValue(true);
    
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriptions: mockSubscriptions }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Subscription canceled successfully' }),
      } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel Subscription');
    fireEvent.click(cancelButton);

    expect(global.confirm).toHaveBeenCalledWith(
      "Are you sure you want to cancel your subscription to Test Artist? You'll lose access to their exclusive content."
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fan/subscriptions/sub-1', {
        method: 'DELETE',
      });
    });

    expect(global.alert).toHaveBeenCalledWith('Subscription canceled successfully');
  });

  it('does not cancel subscription if user declines confirmation', async () => {
    (global.confirm as jest.Mock).mockReturnValue(false);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel Subscription');
    fireEvent.click(cancelButton);

    expect(global.confirm).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the initial fetch
  });

  it('navigates to artist profile when view artist button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('View Artist')).toBeInTheDocument();
    });

    const viewArtistButton = screen.getByText('View Artist');
    fireEvent.click(viewArtistButton);

    expect(mockPush).toHaveBeenCalledWith('/artist/artist-1');
  });

  it('shows canceled subscription notice', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptions: mockSubscriptions }),
    } as Response);

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText(/This subscription has been canceled/)).toBeInTheDocument();
      expect(screen.getByText(/You'll continue to have access until/)).toBeInTheDocument();
    });
  });

  it('shows loading states for actions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriptions: mockSubscriptions }),
      } as Response)
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(screen.getByText('Change Amount')).toBeInTheDocument();
    });

    const changeAmountButton = screen.getByText('Change Amount');
    fireEvent.click(changeAmountButton);

    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('handles fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<SubscriptionManagement />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching subscriptions:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});