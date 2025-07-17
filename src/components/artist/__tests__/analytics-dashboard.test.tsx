import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import AnalyticsDashboard from '../analytics-dashboard';

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
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful fetch responses
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
  });

  it('renders loading state initially', () => {
    render(<AnalyticsDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders analytics dashboard with data', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Check earnings data
    expect(screen.getByText('$1,250.75')).toBeInTheDocument(); // Total earnings
    expect(screen.getByText('$350.50')).toBeInTheDocument(); // Monthly earnings
    expect(screen.getByText('+15.5%')).toBeInTheDocument(); // Earnings growth
    
    // Check subscriber data
    expect(screen.getByText('20')).toBeInTheDocument(); // Active subscribers
    expect(screen.getByText('5 new this month')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument(); // Retention rate
    
    // Check daily earnings summary
    expect(screen.getByText('Daily Earnings Summary')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument(); // Today's earnings
  });

  it('switches between tabs correctly', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Switch to Charts tab
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Charts' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Performance Charts')).toBeInTheDocument();
    });
    
    // Switch to Tier Performance tab
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Tier Performance' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Tier Performance')).toBeInTheDocument();
    });
    
    // Switch to Recent Activity tab
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Recent Activity' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('John Doe subscribed to Basic tier')).toBeInTheDocument();
    });
  });

  it('changes period for charts correctly', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Switch to Charts tab
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Charts' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Performance Charts')).toBeInTheDocument();
    });
    
    // Change period to 7 days
    act(() => {
      fireEvent.click(screen.getByRole('combobox'));
    });
    
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '7 Days' })).toBeInTheDocument();
    });
    
    act(() => {
      fireEvent.click(screen.getByRole('option', { name: '7 Days' }));
    });
    
    // Verify fetch was called with the correct period
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('period=7d'));
  });

  it('handles fetch errors gracefully', async () => {
    // Mock a failed fetch
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    );

    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
    
    // Test retry functionality
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockAnalyticsData }),
      })
    );
    
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  it('displays tier performance data correctly', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Switch to Tier Performance tab
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Tier Performance' }));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Tier Performance')).toBeInTheDocument();
    });
    
    // Check tier data
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    
    // Check churn analysis section
    expect(screen.getByText('Churn Analysis')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument(); // Overall churn rate
    expect(screen.getByText('87.5%')).toBeInTheDocument(); // Retention rate
    expect(screen.getByText('45 days')).toBeInTheDocument(); // Average lifetime
  });
});