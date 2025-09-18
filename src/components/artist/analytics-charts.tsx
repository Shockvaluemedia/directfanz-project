'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Import Chart.js
import Chart from 'chart.js/auto';

interface EarningsChartProps {
  data: { date: string; earnings: number }[];
  period: string;
}

interface SubscriberChartProps {
  data: { 
    date: string; 
    subscribers: number; 
    newSubscribers: number; 
    canceledSubscribers: number; 
  }[];
  period: string;
}

export function EarningsChart({ data, period }: EarningsChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data
    const labels = data.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        ...(period === '1y' && { year: '2-digit' })
      });
    });

    const earnings = data.map(item => item.earnings);

    // Calculate trend
    const trend = earnings.length > 1 ? 
      earnings[earnings.length - 1] > earnings[0] ? 'up' : 'down' : 
      'stable';

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Earnings ($)',
            data: earnings,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `$${context.raw}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, period]);

  // Calculate total earnings for the period
  const totalEarnings = data?.reduce((sum, item) => sum + item.earnings, 0) || 0;
  
  // Calculate average daily earnings
  const avgDailyEarnings = data?.length ? totalEarnings / data.length : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Earnings Over Time</CardTitle>
        <div className="flex items-center">
          {data && data.length > 1 && (
            data[data.length - 1].earnings > data[0].earnings ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )
          )}
          <span className="text-sm font-medium">
            Total: ${totalEarnings.toFixed(2)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <canvas ref={chartRef} />
        </div>
        <div className="flex justify-between mt-4 text-sm text-muted-foreground">
          <span>Avg. Daily: ${avgDailyEarnings.toFixed(2)}</span>
          <span>Data Points: {data?.length || 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubscriberChart({ data, period }: SubscriberChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data
    const labels = data.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        ...(period === '1y' && { year: '2-digit' })
      });
    });

    const subscribers = data.map(item => item.subscribers);
    const newSubscribers = data.map(item => item.newSubscribers);
    const canceledSubscribers = data.map(item => item.canceledSubscribers);

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Subscribers',
            data: subscribers,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          },
          {
            label: 'New Subscribers',
            data: newSubscribers,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Canceled Subscribers',
            data: canceledSubscribers,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 15
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, period]);

  // Calculate net growth
  const netGrowth = data?.length ? 
    data[data.length - 1].subscribers - data[0].subscribers : 
    0;

  // Calculate total new and canceled
  const totalNew = data?.reduce((sum, item) => sum + item.newSubscribers, 0) || 0;
  const totalCanceled = data?.reduce((sum, item) => sum + item.canceledSubscribers, 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Subscriber Growth</CardTitle>
        <div className="flex items-center">
          {netGrowth > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          ) : netGrowth < 0 ? (
            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
          ) : null}
          <span className="text-sm font-medium">
            Net Growth: {netGrowth > 0 ? '+' : ''}{netGrowth}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <canvas ref={chartRef} />
        </div>
        <div className="flex justify-between mt-4 text-sm text-muted-foreground">
          <span className="text-green-600">New: +{totalNew}</span>
          <span className="text-red-600">Canceled: -{totalCanceled}</span>
          <span>Retention: {totalNew > 0 ? Math.round((1 - totalCanceled / totalNew) * 100) : 0}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChurnRateChart({ data }: { data: { tierId: string; tierName: string; churnRate: number }[] }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data
    const labels = data.map(item => item.tierName);
    const churnRates = data.map(item => item.churnRate);
    
    // Create color array based on churn rate values
    const backgroundColors = churnRates.map(rate => {
      if (rate > 20) return 'rgba(239, 68, 68, 0.7)'; // High churn - red
      if (rate > 10) return 'rgba(245, 158, 11, 0.7)'; // Medium churn - amber
      return 'rgba(16, 185, 129, 0.7)'; // Low churn - green
    });

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Churn Rate (%)',
            data: churnRates,
            backgroundColor: backgroundColors,
            borderWidth: 0,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${(context.raw as number).toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            max: Math.max(...churnRates) * 1.2, // Add some headroom
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="h-64">
      <canvas ref={chartRef} />
    </div>
  );
}

export function ChurnReasonsChart({ data }: { data: { reason: string; count: number }[] }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data
    const labels = data.map(item => item.reason);
    const counts = data.map(item => item.count);
    
    // Create color array
    const backgroundColors = [
      'rgba(59, 130, 246, 0.7)', // blue
      'rgba(239, 68, 68, 0.7)',  // red
      'rgba(16, 185, 129, 0.7)', // green
      'rgba(245, 158, 11, 0.7)', // amber
      'rgba(139, 92, 246, 0.7)', // purple
    ];

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: backgroundColors,
            borderWidth: 1,
            borderColor: '#ffffff',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 15
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="h-64">
      <canvas ref={chartRef} />
    </div>
  );
}