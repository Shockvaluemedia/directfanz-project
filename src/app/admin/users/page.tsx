'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  subscriptionCount?: number;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAdmin =
    session?.user?.role === 'ADMIN' ||
    session?.user?.email === 'admin@directfan.com';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error(`Failed to fetch users: ${res.statusText}`);
      }
      const data = await res.json();
      setUsers(data.users ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
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
    fetchUsers();
  }, [session, status, isAdmin, router, fetchUsers]);

  const handleBanToggle = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    setActionLoading(userId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBanned: !currentlyBanned }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} user`);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isBanned: !currentlyBanned } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      search === '' ||
      (user.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === 'ALL' || user.role.toUpperCase() === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (status === 'loading' || (loading && users.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="mt-2 text-gray-600">
              Manage platform users, roles, and access ({users.length} total)
            </p>
          </div>
          <button
            onClick={fetchUsers}
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

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'ADMIN', 'ARTIST', 'FAN'].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  roleFilter === role
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {role === 'ALL' ? 'All Roles' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        {filteredUsers.length === 0 ? (
          <div className="bg-white shadow rounded-lg px-6 py-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">
              {search
                ? `No users match "${search}". Try a different search term.`
                : 'No users to display.'}
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {(user.name ?? user.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.isBanned ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {user.role.toUpperCase() !== 'ADMIN' ? (
                          <button
                            onClick={() => handleBanToggle(user.id, user.isBanned)}
                            disabled={actionLoading === user.id}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              user.isBanned
                                ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white'
                                : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white'
                            }`}
                          >
                            {actionLoading === user.id
                              ? '...'
                              : user.isBanned
                                ? 'Unban'
                                : 'Ban'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    ARTIST: 'bg-purple-100 text-purple-700',
    FAN: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[role.toUpperCase()] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {role}
    </span>
  );
}
