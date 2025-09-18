'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ViewData {
  date: string;
  views: number;
  uniqueViews: number;
}

interface TopContent {
  id: string;
  title: string;
  type: string;
  totalViews: number;
  uniqueViews: number;
  thumbnailUrl?: string;
  visibility: string;
  createdAt: string;
}

interface ContentAnalyticsChartProps {
  data: ViewData[];
  topContent: TopContent[];
}

export function ContentAnalyticsChart({ data, topContent }: ContentAnalyticsChartProps) {
  // Format data for chart display
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }));

  // Calculate growth metrics
  const totalViews = data.reduce((sum, item) => sum + item.views, 0);
  const totalUniqueViews = data.reduce((sum, item) => sum + item.uniqueViews, 0);
  const avgViewsPerDay = data.length > 0 ? totalViews / data.length : 0;
  
  // Growth calculation (last 7 days vs previous 7 days)
  const last7Days = data.slice(-7);
  const previous7Days = data.slice(-14, -7);
  const last7DaysViews = last7Days.reduce((sum, item) => sum + item.views, 0);
  const previous7DaysViews = previous7Days.reduce((sum, item) => sum + item.views, 0);
  const growthRate = previous7DaysViews > 0 
    ? ((last7DaysViews - previous7DaysViews) / previous7DaysViews * 100)
    : 0;

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'bg-green-100 text-green-800';
      case 'TIER_LOCKED':
        return 'bg-blue-100 text-blue-800';
      case 'PRIVATE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">7-Day Growth</p>
                <p className={`text-2xl font-bold ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Daily Views</p>
                <p className="text-2xl font-bold">{Math.round(avgViewsPerDay)}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">View Rate</p>
                <p className="text-2xl font-bold">
                  {totalUniqueViews > 0 ? ((totalViews / totalUniqueViews) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Views per unique viewer</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Views Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Views Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Total Views"
              />
              <Line 
                type="monotone" 
                dataKey="uniqueViews" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Unique Views"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Content */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topContent.slice(0, 10).map((content, index) => (
                <div key={content.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  
                  <div className="flex-shrink-0">
                    {content.thumbnailUrl ? (
                      <img 
                        src={content.thumbnailUrl} 
                        alt={content.title}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <Eye className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <p className="font-medium truncate">{content.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {content.type}
                      </Badge>
                      <Badge 
                        className={`text-xs ${getVisibilityColor(content.visibility)}`}
                        variant="outline"
                      >
                        {content.visibility.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 text-right">
                    <p className="font-semibold">{content.totalViews.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {content.uniqueViews} unique
                    </p>
                  </div>
                </div>
              ))}
              
              {topContent.length === 0 && (
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No content data available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Type Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const typeStats = topContent.reduce((acc, content) => {
                  if (!acc[content.type]) {
                    acc[content.type] = {
                      totalViews: 0,
                      uniqueViews: 0,
                      count: 0
                    };
                  }
                  acc[content.type].totalViews += content.totalViews;
                  acc[content.type].uniqueViews += content.uniqueViews;
                  acc[content.type].count += 1;
                  return acc;
                }, {} as Record<string, { totalViews: number; uniqueViews: number; count: number; }>);

                const chartData = Object.entries(typeStats).map(([type, stats]) => ({
                  type: type.charAt(0).toUpperCase() + type.slice(1),
                  totalViews: stats.totalViews,
                  uniqueViews: stats.uniqueViews,
                  avgViews: Math.round(stats.totalViews / stats.count)
                }));

                return chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="totalViews" fill="#8884d8" name="Total Views" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                      <Eye className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No content data available</p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Performance Insights */}
      {topContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Best Performing Content Type</h4>
                {(() => {
                  const typeAvg = topContent.reduce((acc, content) => {
                    if (!acc[content.type]) {
                      acc[content.type] = { total: 0, count: 0 };
                    }
                    acc[content.type].total += content.totalViews;
                    acc[content.type].count += 1;
                    return acc;
                  }, {} as Record<string, { total: number; count: number; }>);

                  const bestType = Object.entries(typeAvg)
                    .map(([type, stats]) => ({ type, avg: stats.total / stats.count }))
                    .sort((a, b) => b.avg - a.avg)[0];

                  return bestType ? (
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="capitalize">
                        {bestType.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Avg {Math.round(bestType.avg)} views
                      </span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Not enough data</p>
                  );
                })()}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Most Consistent Performer</h4>
                {(() => {
                  const mostConsistent = topContent
                    .filter(content => content.totalViews > 0)
                    .sort((a, b) => (b.uniqueViews / b.totalViews) - (a.uniqueViews / a.totalViews))[0];

                  return mostConsistent ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-medium truncate max-w-32">
                        {mostConsistent.title}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {((mostConsistent.uniqueViews / mostConsistent.totalViews) * 100).toFixed(1)}% unique views
                      </span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Not enough data</p>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}