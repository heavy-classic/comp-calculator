'use client';

import { useState } from 'react';

const SERVICE_TYPES = ['IdeaGen', 'Other'];
const DEAL_TYPES = ['Implementation', 'Renewal', 'SoftwareResale'];
const STATUSES = ['Pending', 'Closed', 'Invoiced'];

export default function DealForm({ deal, onSuccess, onCancel }) {
  const isEdit = !!deal;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customer_name: deal?.customer_name || '',
    deal_name: deal?.deal_name || '',
    service_type: deal?.service_type || 'IdeaGen',
    deal_type: deal?.deal_type || 'Implementation',
    status: deal?.status || 'Pending',
    close_date: deal?.close_date || '',
    notes: deal?.notes || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.deal_name.trim()) {
      setError('Customer name and deal name are required.');
      return;
    }

    setLoading(true);
    setError('');

    const url = isEdit ? `/api/deals/${deal.id}` : '/api/deals';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to save deal.');
      setLoading(false);
      return;
    }

    const data = await res.json();
    onSuccess(data);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Customer Name *</label>
          <input
            type="text"
            className="input"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="e.g. PPPO"
            required
          />
        </div>
        <div>
          <label className="label">Deal Name *</label>
          <input
            type="text"
            className="input"
            value={form.deal_name}
            onChange={(e) => setForm({ ...form, deal_name: e.target.value })}
            placeholder="e.g. PPPO Consulting 2024"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Service Type</label>
          <select
            className="input"
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            IdeaGen = 10% impl / 5% renewal | Other = 4% impl / 2% renewal
          </p>
        </div>
        <div>
          <label className="label">Deal Type</label>
          <select
            className="input"
            value={form.deal_type}
            onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
          >
            {DEAL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Deal Status</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Close Date</label>
          <input
            type="date"
            className="input"
            value={form.close_date}
            onChange={(e) => setForm({ ...form, close_date: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional deal notes..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Saving...' : isEdit ? 'Update Deal' : 'Create Deal'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
