'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface ContentItem {
  id: string;
  title: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT' | 'POST';
  artistName: string;
  artistEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  previewUrl?: string;
  reason?: string;
}

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

function getStatusStyle(status: ContentItem['status']): string {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700';
    case 'APPROVED':
      return 'bg-green-100 text-green-700';
    case 'REJECTED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getTypeBadge(type: ContentItem['type']): string {
  switch (type) {
    case 'IMAGE':
      return 'bg-blue-50 text-blue-600';
    case 'VIDEO':
      return 'bg-purple-50 text-purple-600';
    case 'AUDIO':
      return 'bg-pink-50 text-pink-600';
    case 'TEXT':
      return 'bg-gray-50 text-gray-600';
    case 'POST':
      return 'bg-indigo-50 text-indigo-600';
    default:
      return 'bg-gray-50 text-gray-600';
  }
}

export default function AdminContentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin =
    session?.user?.role === 'ADMIN' ||
    session?.user?.email === 'admin@directfan.com';

  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/content');
      if (!res.ok) {
        throw new Error(`Failed to fetch content: ${res.statusText}`);
      }
      const data = await res.json();
      setContent(data.content ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }
    fetchContent();
  }, [session, status, isAdmin, router, fetchContent]);

  const handleAction = async (contentId: string, action: 'approve' | 'reject') => {
    setActionLoading(contentId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/content/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} content`);
      }

      setContent((prev) =>
        prev.map((item) =>
          item.id === contentId
            ? { ...item, status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} content`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredContent =
    filterStatus === 'ALL'
      ? content
      : content.filter((c) => c.status === filterStatus);

  const pendingCount = content.filter((c) => c.status === 'PENDING').length;

  if (status === 'loading' || (loading && content.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Content Review</h1>
            <p className="mt-2 text-gray-600">
              Review and moderate platform content
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchContent}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              X
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              {s === 'PENDING' && pendingCount > 0 && (
                <span className="ml-1.5 bg-white bg-opacity-30 text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content list */}
        {filteredContent.length === 0 ? (
          <div className="bg-white shadow rounded-lg px-6 py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filterStatus === 'PENDING'
                ? 'No content pending review'
                : `No ${filterStatus.toLowerCase()} content`}
            </h3>
            <p className="text-gray-600">
              {filterStatus === 'PENDING'
                ? 'All content has been reviewed. Check back later.'
                : 'Try changing the filter to see other content.'}
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artist
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContent.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(item.type)}`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.artistName}</div>
                        <div className="text-xs text-gray-500">{item.artistEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {item.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleAction(item.id, 'approve')}
                              disabled={actionLoading === item.id}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                            >
                              {actionLoading === item.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(item.id, 'reject')}
                              disabled={actionLoading === item.id}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                            >
                              {actionLoading === item.id ? '...' : 'Reject'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
