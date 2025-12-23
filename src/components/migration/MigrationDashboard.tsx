/**
 * Migration Dashboard Component
 * Real-time migration progress monitoring and control interface
 * Implements Requirements 11.6
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PlayIcon, 
  PauseIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { MigrationDashboard as DashboardData, MigrationAlert, MigrationPhase } from '@/lib/migration-progress-tracker';

interface MigrationDashboardProps {
  migrationId?: string;
  refreshInterval?: number;
}

export default function MigrationDashboard({ 
  migrationId = 'aws-conversion-2024',
  refreshInterval = 5000 
}: MigrationDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [migrationId, refreshInterval]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`/api/migration/dashboard?migrationId=${migrationId}`);
      const result = await response.json();
      
      if (result.success) {
        setDashboard(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch migration dashboard');
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (action: string, params?: any) => {
    setActionLoading(action);
    try {
      const response = await fetch('/api/migration/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          migrationId,
          action,
          ...params
        })
      });

      const result = await response.json();
      if (result.success) {
        await fetchDashboard(); // Refresh data
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to execute action');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
      case 'critical':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <XCircleIcon className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-700">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboard) {
    return (
      <Alert>
        <InformationCircleIcon className="h-4 w-4" />
        <AlertDescription>
          No migration data available
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Migration Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold">
            Migration Overview
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(dashboard.overview.status)}>
              {dashboard.overview.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {dashboard.overview.status === 'in_progress' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => executeAction('pause')}
                disabled={actionLoading === 'pause'}
              >
                <PauseIcon className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {dashboard.overview.status === 'paused' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => executeAction('resume')}
                disabled={actionLoading === 'resume'}
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{dashboard.overview.overallProgress}%</span>
              </div>
              <Progress value={dashboard.overview.overallProgress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {dashboard.overview.completedPhases}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {dashboard.overview.totalPhases - dashboard.overview.completedPhases - dashboard.overview.failedPhases}
                </div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {dashboard.overview.failedPhases}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatBytes(dashboard.performanceMetrics.totalDataMigrated)}
                </div>
                <div className="text-sm text-gray-600">Data Migrated</div>
              </div>
            </div>

            {dashboard.overview.estimatedCompletion && (
              <div className="text-sm text-gray-600">
                <strong>Estimated Completion:</strong> {' '}
                {new Date(dashboard.overview.estimatedCompletion).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Phase Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboard.overview.phases.map((phase: MigrationPhase) => (
              <div key={phase.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(phase.status)}
                    <span className="font-medium">{phase.name}</span>
                  </div>
                  <Badge className={getStatusColor(phase.status)}>
                    {phase.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{phase.progress}%</span>
                  </div>
                  <Progress value={phase.progress} className="h-2" />
                </div>

                <div className="text-sm text-gray-600">
                  {phase.description}
                </div>

                {phase.startTime && (
                  <div className="text-xs text-gray-500 mt-2">
                    Started: {new Date(phase.startTime).toLocaleString()}
                    {phase.endTime && (
                      <span className="ml-4">
                        Completed: {new Date(phase.endTime).toLocaleString()}
                      </span>
                    )}
                    {phase.actualDuration && (
                      <span className="ml-4">
                        Duration: {formatDuration(phase.actualDuration)}
                      </span>
                    )}
                  </div>
                )}

                {phase.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-red-600 mb-1">Errors:</div>
                    {phase.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      {dashboard.recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard.recentAlerts.map((alert: MigrationAlert) => (
                <div key={alert.id} className="flex items-start space-x-2 p-3 border rounded-lg">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{alert.message}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleString()}
                      {alert.phase && <span className="ml-2">Phase: {alert.phase}</span>}
                      {alert.subTask && <span className="ml-2">Task: {alert.subTask}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    alert.type === 'critical' || alert.type === 'error' ? 'border-red-200 text-red-700' :
                    alert.type === 'warning' ? 'border-yellow-200 text-yellow-700' :
                    'border-blue-200 text-blue-700'
                  }>
                    {alert.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {(dashboard.performanceMetrics.migrationSpeed / 1024 / 1024).toFixed(2)} MB/s
              </div>
              <div className="text-sm text-gray-600">Migration Speed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {dashboard.performanceMetrics.errorRate.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {dashboard.performanceMetrics.successfulOperations}
              </div>
              <div className="text-sm text-gray-600">Successful Ops</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {dashboard.performanceMetrics.averageOperationTime}ms
              </div>
              <div className="text-sm text-gray-600">Avg Op Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}