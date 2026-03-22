'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, RefreshCw, Building2 } from 'lucide-react';

export default function CustomersClient() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  async function fetchCustomers() {
    setLoading(true);
    const res = await fetch('/api/customers');
    if (res.ok) setCustomers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchCustomers(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError('');
    setAddLoading(true);

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error || 'Failed to add customer');
    } else {
      setNewName('');
      fetchCustomers();
    }
    setAddLoading(false);
  }

  function startEdit(customer) {
    setEditingId(customer.id);
    setEditName(customer.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    setActionLoading(id + '-rename');

    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });

    setActionLoading(null);
    if (res.ok) {
      setEditingId(null);
      fetchCustomers();
    }
  }

  async function handleDelete(customer) {
    if (!confirm(`Delete "${customer.name}"? This won't affect existing deals.`)) return;
    setActionLoading(customer.id + '-delete');

    const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) alert(data.error || 'Failed to delete');
    setActionLoading(null);
    fetchCustomers();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">Manage the customer picklist shown when creating deals</p>
        </div>
        <button
          onClick={fetchCustomers}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Add customer */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Add Customer</h2>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Customer name"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={addLoading || !newName.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {addLoading ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && (
          <p className="text-sm text-red-600 mt-2">{addError}</p>
        )}
      </div>

      {/* Customer list */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No customers yet. Add one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                {editingId === c.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(c.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="input flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(c.id)}
                      disabled={actionLoading === c.id + '-rename'}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-800">{c.name}</span>
                    <button
                      onClick={() => startEdit(c)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={actionLoading === c.id + '-delete'}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
