'use client';

import { useState, useEffect } from 'react';
import { calculateLineItemCommission, formatCurrency } from '@/lib/commission';

const STATUSES = ['Pending', 'Invoiced'];
const ITEM_TYPES = ['License', 'Support', 'Maintenance', 'Consulting', 'Other'];

export default function LineItemForm({ deal, lineItem, onSuccess, onCancel }) {
  const isEdit = !!lineItem;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    description: lineItem?.description || '',
    item_type: lineItem?.item_type || 'Consulting',
    amount: lineItem?.amount || '',
    net_profit: lineItem?.net_profit || '',
    gross_margin_percent: lineItem?.gross_margin_percent || '',
    invoice_date: lineItem?.invoice_date || '',
    status: lineItem?.status || 'Pending',
    year_number: lineItem?.year_number || 1,
    is_upsell: lineItem?.is_upsell || false,
  });

  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (form.amount) {
      const calc = calculateLineItemCommission({
        dealType: deal.deal_type,
        serviceType: deal.service_type,
        amount: parseFloat(form.amount) || 0,
        netProfit: parseFloat(form.net_profit) || null,
        grossMarginPercent: form.gross_margin_percent !== '' ? parseFloat(form.gross_margin_percent) : null,
        yearNumber: parseInt(form.year_number) || 1,
        isUpsell: form.is_upsell,
      });
      setPreview(calc);
    } else {
      setPreview(null);
    }
  }, [form.amount, form.net_profit, form.gross_margin_percent, form.year_number, form.is_upsell, deal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) {
      setError('Description and amount are required.');
      return;
    }

    setLoading(true);
    setError('');

    const url = isEdit
      ? `/api/line-items/${lineItem.id}`
      : `/api/deals/${deal.id}/line-items`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        net_profit: form.net_profit !== '' ? parseFloat(form.net_profit) : null,
        gross_margin_percent: form.gross_margin_percent !== '' ? parseFloat(form.gross_margin_percent) : null,
        year_number: parseInt(form.year_number) || 1,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to save line item.');
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

      {/* Commission Preview */}
      {preview && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          preview.isExcluded
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {preview.isExcluded ? (
            <span>⚠️ <strong>Excluded:</strong> {preview.exclusionReason}</span>
          ) : (
            <span>
              💰 Estimated commission: <strong>{formatCurrency(preview.commissionAmount)}</strong>
              {' '}({(preview.rate * 100).toFixed(1)}% rate)
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Description *</label>
          <input
            type="text"
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Monthly consulting fee - Jan 2025"
            required
          />
        </div>
        <div>
          <label className="label">Item Type</label>
          <select
            className="input"
            value={form.item_type}
            onChange={(e) => setForm({ ...form, item_type: e.target.value })}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount ($) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        {deal.deal_type === 'SoftwareResale' ? (
          <div>
            <label className="label">Net Profit ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.net_profit}
              onChange={(e) => setForm({ ...form, net_profit: e.target.value })}
              placeholder="Commission is based on net profit"
            />
            <p className="text-xs text-slate-400 mt-1">Used for commission calc (Yr1: 35%, Yr2+: 15%)</p>
          </div>
        ) : (
          <div>
            <label className="label">Gross Margin %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="input"
              value={form.gross_margin_percent}
              onChange={(e) => setForm({ ...form, gross_margin_percent: e.target.value })}
              placeholder="Leave blank if N/A"
            />
            <p className="text-xs text-slate-400 mt-1">If ≤25%, commission is excluded</p>
          </div>
        )}
      </div>

      {deal.deal_type === 'SoftwareResale' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Year Number</label>
            <select
              className="input"
              value={form.year_number}
              onChange={(e) => setForm({ ...form, year_number: parseInt(e.target.value) })}
            >
              <option value={1}>Year 1 (35% of Net Profit)</option>
              <option value={2}>Year 2+ (15% of Net Profit)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="is_upsell"
              checked={form.is_upsell}
              onChange={(e) => setForm({ ...form, is_upsell: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <label htmlFor="is_upsell" className="text-sm text-slate-700">
              Upsell / Incremental Revenue
              <span className="block text-xs text-slate-400">(35% for Year 2+ upsell)</span>
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Invoice Date</label>
          <input
            type="date"
            className="input"
            value={form.invoice_date}
            onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">When this line item will be/was invoiced</p>
        </div>
        <div>
          <label className="label">Status</label>
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
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Saving...' : isEdit ? 'Update Line Item' : 'Add Line Item'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
