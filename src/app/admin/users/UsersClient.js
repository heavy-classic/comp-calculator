'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield, User, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function UsersClient() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });

    const data = await res.json();

    if (!res.ok) {
      setCreateError(data.error || 'Failed to create user');
      setCreateLoading(false);
      return;
    }

    setCreateForm({ email: '', password: '', role: 'user' });
    setShowCreate(false);
    setCreateLoading(false);
    fetchUsers();
  }

  async function handleRoleToggle(user) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setActionLoading(user.id + '-role');

    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    setActionLoading(null);
    fetchUsers();
  }

  async function handleDelete(user) {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setActionLoading(user.id + '-delete');

    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to delete user');
    }

    setActionLoading(null);
    fetchUsers();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1">Manage who has access to the app</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Create user form */}
      {showCreate && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Create New User</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="input w-full"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="input w-full"
                  placeholder="Min. 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="input w-full"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="btn-primary disabled:opacity-60"
              >
                {createLoading ? 'Creating…' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-5 text-slate-500 font-medium">Email</th>
                <th className="text-left py-3 px-5 text-slate-500 font-medium">Role</th>
                <th className="text-left py-3 px-5 text-slate-500 font-medium">Joined</th>
                <th className="text-left py-3 px-5 text-slate-500 font-medium">Last Sign In</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-5 font-medium text-slate-900">{u.email}</td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.role === 'admin' ? (
                        <Shield className="w-3 h-3" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-slate-500">
                    {u.created_at ? format(parseISO(u.created_at), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="py-3 px-5 text-slate-500">
                    {u.last_sign_in_at
                      ? format(parseISO(u.last_sign_in_at), 'MMM d, yyyy')
                      : 'Never'}
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRoleToggle(u)}
                        disabled={actionLoading === u.id + '-role'}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        {actionLoading === u.id + '-role'
                          ? '…'
                          : u.role === 'admin'
                          ? 'Demote'
                          : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={actionLoading === u.id + '-delete'}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
