'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ExclamationTriangleIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useApi, useApiMutation } from '@/hooks/use-api';
import { LoadingState, LoadingSpinner, SkeletonCard } from '@/components/ui/loading';
import Modal from '@/components/ui/modal';

interface Report {
  id: string;
  reporterId: string;
  targetType: 'user' | 'content' | 'comment';
  targetId: string;
  reason: string;
  description: string;
  evidence: string[];
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high';
  resolution?: string;
  action?: 'none' | 'warning' | 'content_removal' | 'temporary_suspension' | 'permanent_ban';
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reporter: {
    id: string;
    displayName: string;
  };
  reviewer?: {
    id: string;
    displayName: string;
  };
}

interface ReportsResponse {
  reports: Report[];
  stats: {
    total: number;
    pending: number;
    reviewing: number;
    resolved: number;
    dismissed: number;
    highPriority: number;
  };
}

interface ModerationStats {
  total: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  highPriority: number;
}

export default function ModerationDashboard() {
  const { data: session } = useSession();
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);

  // Fetch reports
  const {
    data: reportsResponse,
    loading: loadingReports,
    error: reportsError,
    execute: fetchReports,
  } = useApi<ReportsResponse>(
    `/api/moderation/reports?status=${selectedStatus}&priority=${selectedPriority}`,
    {
      immediate: true,
    }
  );

  // Update report mutation
  const { loading: updatingReport, mutate: updateReport } = useApiMutation<
    any,
    {
      reportId: string;
      status: string;
      resolution?: string;
      action?: string;
    }
  >('/api/moderation/reports', {
    method: 'PUT',
    onSuccess: () => {
      setActionModalOpen(false);
      setSelectedReport(null);
      fetchReports();
    },
  });

  const reports = reportsResponse?.reports || [];
  const stats = reportsResponse?.stats || {
    total: 0,
    pending: 0,
    reviewing: 0,
    resolved: 0,
    dismissed: 0,
    highPriority: 0,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'reviewing':
        return 'text-blue-600 bg-blue-100';
      case 'resolved':
        return 'text-green-600 bg-green-100';
      case 'dismissed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleTakeAction = (report: Report) => {
    setSelectedReport(report);
    setActionModalOpen(true);
  };

  const handleUpdateReport = async (action: string, resolution: string) => {
    if (!selectedReport) return;

    try {
      await updateReport({
        reportId: selectedReport.id,
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        resolution,
        action: action === 'dismiss' ? 'none' : action,
      });
    } catch (error) {
      console.error('Failed to update report:', error);
    }
  };

  // Only allow access to admin users
  if (session?.user.role !== 'ADMIN') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <ShieldCheckIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
          <h2 className='text-xl font-semibold text-gray-900 mb-2'>Access Denied</h2>
          <p className='text-gray-600'>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 flex items-center'>
            <ShieldCheckIcon className='w-8 h-8 mr-3 text-indigo-600' />
            Content Moderation
          </h1>
          <p className='mt-2 text-gray-600'>Review and manage content reports</p>
        </div>

        {/* Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8'>
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-gray-100 rounded-lg'>
                <ExclamationTriangleIcon className='w-6 h-6 text-gray-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>Total Reports</p>
                <p className='text-2xl font-semibold text-gray-900'>{stats.total}</p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-yellow-100 rounded-lg'>
                <ClockIcon className='w-6 h-6 text-yellow-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>Pending</p>
                <p className='text-2xl font-semibold text-yellow-600'>{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-blue-100 rounded-lg'>
                <EyeIcon className='w-6 h-6 text-blue-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>Reviewing</p>
                <p className='text-2xl font-semibold text-blue-600'>{stats.reviewing}</p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-green-100 rounded-lg'>
                <CheckCircleIcon className='w-6 h-6 text-green-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>Resolved</p>
                <p className='text-2xl font-semibold text-green-600'>{stats.resolved}</p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-gray-100 rounded-lg'>
                <XCircleIcon className='w-6 h-6 text-gray-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>Dismissed</p>
                <p className='text-2xl font-semibold text-gray-600'>{stats.dismissed}</p>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <div className='flex items-center'>
              <div className='p-2 bg-red-100 rounded-lg'>
                <ExclamationTriangleIcon className='w-6 h-6 text-red-600' />
              </div>
              <div className='ml-4'>
                <p className='text-sm text-gray-600'>High Priority</p>
                <p className='text-2xl font-semibold text-red-600'>{stats.highPriority}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6'>
          <div className='flex flex-wrap gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className='border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
              >
                <option value='pending'>Pending</option>
                <option value='reviewing'>Reviewing</option>
                <option value='resolved'>Resolved</option>
                <option value='dismissed'>Dismissed</option>
                <option value='all'>All</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Priority</label>
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className='border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
              >
                <option value='all'>All Priorities</option>
                <option value='high'>High</option>
                <option value='medium'>Medium</option>
                <option value='low'>Low</option>
              </select>
            </div>

            <div className='flex items-end'>
              <button
                onClick={() => fetchReports()}
                className='bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
          <LoadingState
            loading={loadingReports}
            fallback={
              <div className='p-6 space-y-4'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} lines={3} />
                ))}
              </div>
            }
          >
            {reportsError ? (
              <div className='p-6 text-center'>
                <p className='text-red-600 mb-2'>Failed to load reports</p>
                <button
                  onClick={() => fetchReports()}
                  className='text-indigo-600 hover:text-indigo-500 font-medium'
                >
                  Try again
                </button>
              </div>
            ) : reports.length === 0 ? (
              <div className='p-6 text-center text-gray-500'>
                <ExclamationTriangleIcon className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                <p className='font-medium mb-2'>No reports found</p>
                <p className='text-sm'>There are no reports matching your current filters.</p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-gray-200'>
                  <thead className='bg-gray-50'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Report Details
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Status
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Priority
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Created
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className='bg-white divide-y divide-gray-200'>
                    {reports.map(report => (
                      <tr key={report.id} className='hover:bg-gray-50'>
                        <td className='px-6 py-4'>
                          <div className='text-sm'>
                            <div className='font-medium text-gray-900'>
                              {report.reason.replace(/_/g, ' ').toUpperCase()} - {report.targetType}
                            </div>
                            <div className='text-gray-500 mt-1'>
                              Reporter: {report.reporter.displayName}
                            </div>
                            <div className='text-gray-500 truncate max-w-xs'>
                              {report.description}
                            </div>
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}
                          >
                            {report.status}
                          </span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(report.priority)}`}
                          >
                            {report.priority}
                          </span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                          {formatDate(report.createdAt)}
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap text-sm'>
                          {report.status === 'pending' || report.status === 'reviewing' ? (
                            <button
                              onClick={() => handleTakeAction(report)}
                              className='text-indigo-600 hover:text-indigo-900 font-medium'
                            >
                              Take Action
                            </button>
                          ) : (
                            <span className='text-gray-400'>
                              {report.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LoadingState>
        </div>

        {/* Action Modal */}
        <Modal
          isOpen={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title='Take Moderation Action'
          size='lg'
        >
          {selectedReport && (
            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-medium text-gray-900 mb-2'>Report Details</h3>
                <div className='bg-gray-50 p-4 rounded-lg space-y-2'>
                  <p>
                    <strong>Type:</strong> {selectedReport.targetType}
                  </p>
                  <p>
                    <strong>Reason:</strong> {selectedReport.reason.replace(/_/g, ' ')}
                  </p>
                  <p>
                    <strong>Description:</strong> {selectedReport.description}
                  </p>
                  <p>
                    <strong>Reporter:</strong> {selectedReport.reporter.displayName}
                  </p>
                </div>
              </div>

              <div className='flex space-x-3'>
                <button
                  onClick={() => handleUpdateReport('warning', 'Warning issued to user')}
                  disabled={updatingReport}
                  className='flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50'
                >
                  {updatingReport ? <LoadingSpinner size='sm' color='white' /> : 'Issue Warning'}
                </button>

                <button
                  onClick={() =>
                    handleUpdateReport('content_removal', 'Content removed for policy violation')
                  }
                  disabled={updatingReport}
                  className='flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50'
                >
                  {updatingReport ? <LoadingSpinner size='sm' color='white' /> : 'Remove Content'}
                </button>

                <button
                  onClick={() =>
                    handleUpdateReport(
                      'dismiss',
                      'Report reviewed and dismissed - no violation found'
                    )
                  }
                  disabled={updatingReport}
                  className='flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50'
                >
                  {updatingReport ? <LoadingSpinner size='sm' color='white' /> : 'Dismiss'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
