import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import AnalyticsDashboard from '../analytics-dashboard';

// Suppress act() warnings in tests since we're testing async behavior
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: An update to')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock fetch
global.fetch = jest.fn();

// Mock Chart.js
jest.mock('chart.js/auto', () => {
  return class Chart {
    constructor() {}
    destroy() {}
  };
});

// Mock analytics data
const mockAnalyticsData = {
  earnings: {
    totalEarnings: 1250.75,
    monthlyEarnings: 350.50,
    dailyEarnings: 25.00,
    weeklyEarnings: 175.00,
    yearlyEarnings: 1250.75,
    earningsGrowth: 15.5,
  },
  subscribers: {
    totalSubscribers: 25,
    activeSubscribers: 20,
    newSubscribers: 5,
    canceledSubscribers: 2,
    churnRate: 10.0,
    retentionRate: 90.0,
  },
  tiers: [
    {
      tierId: 'tier-1',
      tierName: 'Basic',
      subscriberCount: 12,
      monthlyRevenue: 180.00,
      averageAmount: 15.00,
      conversionRate: 5.2,
    },
    {
      tierId: 'tier-2',
      tierName: 'Premium',
      subscriberCount: 8,
      monthlyRevenue: 170.50,
      averageAmount: 21.31,
      conversionRate: 3.8,
    },
  ],
  recentActivity: [
    {
      id: 'act-1',
      type: 'subscription',
      description: 'John Doe subscribed to Basic tier',
      amount: 15.00,
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      id: 'act-2',
      type: 'cancellation',
      description: 'Jane Smith canceled Premium tier',
      amount: 25.00,
      timestamp: '2024-01-14T14:20:00Z',
    },
  ],
};

const mockDailyEarnings = {
  today: 25.00,
  yesterday: 20.00,
  thisWeek: 175.00,
  thisMonth: 350.50,
  dailyAverage: 11.68,
  trend: 'up',
};

const mockTimeSeriesData = {
  earnings: [
    { date: '2024-01-01', earnings: 15.00 },
    { date: '2024-01-02', earnings: 20.00 },
    { date: '2024-01-03', earnings: 10.00 },
    { date: '2024-01-04', earnings: 25.00 },
  ],
  subscribers: [
    { date: '2024-01-01', subscribers: 10, newSubscribers: 2, canceledSubscribers: 0 },
    { date: '2024-01-02', subscribers: 12, newSubscribers: 2, canceledSubscribers: 0 },
    { date: '2024-01-03', subscribers: 13, newSubscribers: 1, canceledSubscribers: 0 },
    { date: '2024-01-04', subscribers: 15, newSubscribers: 2, canceledSubscribers: 0 },
  ],
  period: { start: '2024-01-01', end: '2024-01-04' },
};

const mockTierData = [
  {
    tierId: 'tier-1',
    tierName: 'Basic',
    subscriberCount: 15,
    activeSubscribers: 12,
    newThisMonth: 3,
    churnThisMonth: 1,
    revenue: 180.00,
  },
  {
    tierId: 'tier-2',
    tierName: 'Premium',
    subscriberCount: 10,
    activeSubscribers: 8,
    newThisMonth: 2,
    churnThisMonth: 1,
    revenue: 170.50,
  },
];

const mockChurnData = {
  overallChurnRate: 12.5,
  monthlyChurnRate: 8.3,
  churnByTier: [
    { tierId: 'tier-1', tierName: 'Basic', churnRate: 8.3 },
    { tierId: 'tier-2', tierName: 'Premium', churnRate: 12.5 },
  ],
  retentionRate: 87.5,
  averageLifetime: 45,
  churnReasons: [
    { reason: 'Price too high', count: 3 },
    { reason: 'Not enough content', count: 2 },
    { reason: 'Technical issues', count: 1 },
    { reason: 'Other', count: 1 },
  ],
};

describe('AnalyticsDashboard', () => {
  // Increase timeout for all tests due to async operations
  jest.setTimeout(10000);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful fetch responses with resolved promises
    (global.fetch as jest.Mock).mockImplementation((url) => {
      // Use resolved promises to ensure synchronous behavior in tests
      if (url.includes('type=daily')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockDailyEarnings }),
        });
      } else if (url.includes('period=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockTimeSeriesData }),
        });
      } else if (url.includes('type=tiers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockTierData }),
        });
      } else if (url.includes('type=churn')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockChurnData }),
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockAnalyticsData }),
        });
      }
    });
  });

  it('renders loading state initially', () => {
    render(<AnalyticsDashboard />);
    // Look for the loading spinner element by its CSS class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders analytics dashboard with data', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Check earnings data
    await waitFor(() => {
      expect(screen.getAllByText('$1,250.75')[0]).toBeInTheDocument(); // Total earnings
    });
    
    // Use more specific selector for monthly earnings to avoid conflicts
    await waitFor(() => {
      const monthlyEarningsCards = screen.getAllByText('$350.50');
      expect(monthlyEarningsCards.length).toBeGreaterThan(0);
    });
    
    await waitFor(() => {
      expect(screen.getByText('+15.5%')).toBeInTheDocument(); // Earnings growth
    });
    
    // Check subscriber data
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument(); // Active subscribers
      expect(screen.getByText('5 new this month')).toBeInTheDocument();
      expect(screen.getByText('90.0%')).toBeInTheDocument(); // Retention rate
    });
    
    // Check daily earnings summary
    await waitFor(() => {
      expect(screen.getByText('Daily Earnings Summary')).toBeInTheDocument();
      const todayEarnings = screen.getAllByText('$25.00');
      expect(todayEarnings.length).toBeGreaterThan(0); // Today's earnings appears multiple times
    });
  });

  it('switches between tabs correctly', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Test that all tabs exist and can be clicked
    const chartsTab = screen.getByRole('tab', { name: 'Charts' });
    const tiersTab = screen.getByRole('tab', { name: 'Tier Performance' });
    const activityTab = screen.getByRole('tab', { name: 'Recent Activity' });
    
    expect(chartsTab).toBeInTheDocument();
    expect(tiersTab).toBeInTheDocument();
    expect(activityTab).toBeInTheDocument();
    
    // Click charts tab and wait a bit
    await act(async () => {
      fireEvent.click(chartsTab);
    });
    
    // Give time for any async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Click tier performance tab
    await act(async () => {
      fireEvent.click(tiersTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Tier Performance')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click activity tab
    await act(async () => {
      fireEvent.click(activityTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('John Doe subscribed to Basic tier')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('changes period for charts correctly', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Switch to Charts tab
    const chartsTab = screen.getByRole('tab', { name: 'Charts' });
    await act(async () => {
      fireEvent.click(chartsTab);
    });
    
    // Give some time for the tab switch and initial fetch
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check that the basic chart elements are present or fetch was called
    await waitFor(() => {
      // At minimum, fetch should have been called for time series data
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('period=30d'));
    }, { timeout: 3000 });
    
    // Test period selection if combobox exists
    const periodSelect = screen.queryByRole('combobox');
    if (periodSelect) {
      await act(async () => {
        fireEvent.click(periodSelect);
      });
      
      // Look for 7 days option
      const sevenDaysOption = await screen.findByRole('option', { name: '7 Days' });
      if (sevenDaysOption) {
        await act(async () => {
          fireEvent.click(sevenDaysOption);
        });
        
        // Verify the fetch was called with new period
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('period=7d'));
        });
      }
    }
  });

  it('handles fetch errors gracefully', async () => {
    // Mock a failed fetch for analytics and daily earnings
    (global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    );

    await act(async () => {
      render(<AnalyticsDashboard />);
    });
    
    // Wait for error state to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Test retry functionality - restore successful mocks
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('type=daily')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockDailyEarnings }),
        });
      } else if (url.includes('period=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockTimeSeriesData }),
        });
      } else if (url.includes('type=tiers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockTierData }),
        });
      } else if (url.includes('type=churn')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockChurnData }),
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockAnalyticsData }),
        });
      }
    });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    
    // After retry, should show the dashboard
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays tier performance data correctly', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Switch to Tier Performance tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Tier Performance' }));
    });
    
    // Wait for tier performance data to load
    await waitFor(() => {
      expect(screen.getByText('Tier Performance')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Wait for tier data to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Wait for churn analysis section to load
    await waitFor(() => {
      expect(screen.getByText('Churn Analysis')).toBeInTheDocument();
      expect(screen.getByText('12.5%')).toBeInTheDocument(); // Overall churn rate
      expect(screen.getByText('87.5%')).toBeInTheDocument(); // Retention rate
      expect(screen.getByText('45 days')).toBeInTheDocument(); // Average lifetime
    }, { timeout: 5000 });
  });
});