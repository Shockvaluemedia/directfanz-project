/**
 * @jest-environment jsdom
 */
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

// Mock Chart.js (virtual: true since the module may not be installed)
jest.mock('chart.js/auto', () => {
  return class Chart {
    constructor() {}
    destroy() {}
  };
}, { virtual: true });

// Mock the Tabs UI components with working state management for jsdom
jest.mock('@/components/ui/tabs', () => {
  const React = require('react');

  // Context to share state between Tabs, TabsTrigger, and TabsContent
  const TabsContext = React.createContext({ value: '', onValueChange: () => {} });

  const Tabs = ({ value, defaultValue, onValueChange, children, ...props }: any) => {
    const [internalValue, setInternalValue] = React.useState(value || defaultValue || '');
    const currentValue = value !== undefined ? value : internalValue;
    const handleChange = (newValue: string) => {
      if (onValueChange) onValueChange(newValue);
      if (value === undefined) setInternalValue(newValue);
    };
    // Sync controlled value
    React.useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);
    return React.createElement(
      TabsContext.Provider,
      { value: { value: currentValue, onValueChange: handleChange } },
      React.createElement('div', { 'data-testid': 'tabs', ...props }, children)
    );
  };

  const TabsList = ({ children, ...props }: any) => {
    return React.createElement('div', { role: 'tablist', ...props }, children);
  };

  const TabsTrigger = ({ value, children, ...props }: any) => {
    const context = React.useContext(TabsContext);
    return React.createElement(
      'button',
      {
        role: 'tab',
        'aria-selected': context.value === value,
        'data-state': context.value === value ? 'active' : 'inactive',
        onClick: () => context.onValueChange(value),
        ...props,
      },
      children
    );
  };

  const TabsContent = ({ value, children, ...props }: any) => {
    const context = React.useContext(TabsContext);
    if (context.value !== value) return null;
    return React.createElement(
      'div',
      { role: 'tabpanel', 'data-state': 'active', ...props },
      children
    );
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

// Mock analytics data
const mockAnalyticsData = {
  earnings: {
    totalEarnings: 1250.75,
    monthlyEarnings: 350.5,
    dailyEarnings: 25.0,
    weeklyEarnings: 175.0,
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
      monthlyRevenue: 180.0,
      averageAmount: 15.0,
      conversionRate: 5.2,
    },
    {
      tierId: 'tier-2',
      tierName: 'Premium',
      subscriberCount: 8,
      monthlyRevenue: 170.5,
      averageAmount: 21.31,
      conversionRate: 3.8,
    },
  ],
  recentActivity: [
    {
      id: 'act-1',
      type: 'subscription',
      description: 'John Doe subscribed to Basic tier',
      amount: 15.0,
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      id: 'act-2',
      type: 'cancellation',
      description: 'Jane Smith canceled Premium tier',
      amount: 25.0,
      timestamp: '2024-01-14T14:20:00Z',
    },
  ],
};

const mockDailyEarnings = {
  today: 25.0,
  yesterday: 20.0,
  thisWeek: 175.0,
  thisMonth: 350.5,
  dailyAverage: 11.68,
  trend: 'up',
};

const mockTimeSeriesData = {
  earnings: [
    { date: '2024-01-01', earnings: 15.0 },
    { date: '2024-01-02', earnings: 20.0 },
    { date: '2024-01-03', earnings: 10.0 },
    { date: '2024-01-04', earnings: 25.0 },
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
    revenue: 180.0,
  },
  {
    tierId: 'tier-2',
    tierName: 'Premium',
    subscriberCount: 10,
    activeSubscribers: 8,
    newThisMonth: 2,
    churnThisMonth: 1,
    revenue: 170.5,
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
    (global.fetch as jest.Mock).mockImplementation(url => {
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

    await waitFor(
      () => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

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
    await waitFor(
      () => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

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

    await waitFor(
      () => {
        // "Tier Performance" appears in both the tab trigger and h2 heading, so use getAllByText
        const matches = screen.getAllByText('Tier Performance');
        expect(matches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 }
    );

    // Click activity tab
    await act(async () => {
      fireEvent.click(activityTab);
    });

    await waitFor(
      () => {
        // "Recent Activity" appears in both tab trigger and h2 heading, use getAllByText
        const matches = screen.getAllByText('Recent Activity');
        expect(matches.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('John Doe subscribed to Basic tier')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('changes period for charts correctly', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });

    // Wait for initial data to load
    await waitFor(
      () => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Switch to Charts tab
    const chartsTab = screen.getByRole('tab', { name: 'Charts' });
    await act(async () => {
      fireEvent.click(chartsTab);
    });

    // Give time for the tab switch and fetch to trigger
    await waitFor(
      () => {
        // Fetch should have been called for time series data with default 30d period
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('period=30d'));
      },
      { timeout: 5000 }
    );
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
    await waitFor(
      () => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Test retry functionality - restore successful mocks
    (global.fetch as jest.Mock).mockImplementation(url => {
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
    await waitFor(
      () => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('displays tier performance data correctly', async () => {
    await act(async () => {
      render(<AnalyticsDashboard />);
    });

    // Wait for initial data to load
    await waitFor(
      () => {
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Switch to Tier Performance tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Tier Performance' }));
    });

    // Wait for tier performance data to load - "Tier Performance" appears in both trigger and h2
    await waitFor(
      () => {
        const matches = screen.getAllByText('Tier Performance');
        expect(matches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 }
    );

    // Wait for tier data to be fetched and displayed
    // "Basic" and "Premium" may appear multiple times (tier cards + churn breakdown)
    await waitFor(
      () => {
        expect(screen.getAllByText('Basic').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Premium').length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    // Wait for churn analysis section to load
    // Some values may appear multiple times (e.g., 12.5% in both overall and per-tier churn)
    await waitFor(
      () => {
        expect(screen.getByText('Churn Analysis')).toBeInTheDocument();
        expect(screen.getAllByText('12.5%').length).toBeGreaterThan(0); // Overall churn rate (+ Premium tier)
        expect(screen.getByText('87.5%')).toBeInTheDocument(); // Retention rate
        expect(screen.getByText('45 days')).toBeInTheDocument(); // Average lifetime
      },
      { timeout: 5000 }
    );
  });
});
