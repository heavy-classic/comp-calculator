'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Calendar,
  DollarSign,
  Receipt,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/commission';
import DealForm from '@/components/DealForm';
import LineItemForm from '@/components/LineItemForm';
import { format, parseISO } from 'date-fns';

function StatusBadge({ status }) {
  const classes = {
    Pending: 'badge-pending',
    Closed: 'badge-closed',
    Invoiced: 'badge-invoiced',
  };
  return <span className={classes[status] || 'badge-pending'}>{status}</span>;
}

function DealTypeBadge({ type }) {
  const colors = {
    Implementation: 'bg-blue-100 text-blue-700',
    Renewal: 'bg-green-100 text-green-700',
    SoftwareResale: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-slate-100 text-slate-600'}`}>
      {type}
    </span>
  );
}

function InvoiceForm({ lineItem, onAdd, onCancel }) {
  const [form, setForm] = useState({ amount: '', invoice_date: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalInvoiced = (lineItem.line_item_invoices || []).reduce(
    (s, inv) => s + parseFloat(inv.amount || 0), 0
  );
  const remaining = parseFloat(lineItem.amount || 0) - totalInvoiced;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.invoice_date) {
      setError('Amount and date are required.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch(`/api/line-items/${lineItem.id}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(form.amount),
        invoice_date: form.invoice_date,
        notes: form.notes || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || 'Failed to add invoice.');
      setLoading(false);
      return;
    }
    const newInvoice = await res.json();
    onAdd(newInvoice);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-3 space-y-3">
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Amount ($) *
            {remaining > 0 && (
              <span className="text-slate-400 font-normal ml-1">
                ({formatCurrency(remaining)} remaining)
              </span>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input text-sm"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Invoice Date *</label>
          <input
            type="date"
            className="input text-sm"
            value={form.invoice_date}
            onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Notes</label>
        <input
          type="text"
          className="input text-sm"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm py-1.5 px-4">
          {loading ? 'Adding...' : 'Add Invoice'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-1.5 px-4">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function DealDetailClient({ deal: initialDeal }) {
  const router = useRouter();
  const [deal, setDeal] = useState(initialDeal);
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [addingInvoiceTo, setAddingInvoiceTo] = useState(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const [collapsedItems, setCollapsedItems] = useState({});

  const lineItems = deal.deal_line_items || [];
  const totalCommission = lineItems
    .filter((i) => !i.is_excluded)
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const invoicedCommission = lineItems
    .flatMap((i) => i.line_item_invoices || [])
    .reduce((s, inv) => s + parseFloat(inv.commission_amount || 0), 0);
  const pendingCommission = totalCommission - invoicedCommission;

  const toggleCollapse = (itemId) => {
    setCollapsedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleDealUpdated = (updatedDeal) => {
    setDeal((prev) => ({ ...prev, ...updatedDeal }));
    setShowEditDeal(false);
  };

  const handleLineItemAdded = (newItem) => {
    setDeal((prev) => ({
      ...prev,
      deal_line_items: [...(prev.deal_line_items || []), newItem],
    }));
    setShowAddItem(false);
  };

  const handleLineItemUpdated = (updatedItem) => {
    setDeal((prev) => ({
      ...prev,
      deal_line_items: (prev.deal_line_items || []).map((i) =>
        i.id === updatedItem.id
          ? { ...updatedItem, line_item_invoices: i.line_item_invoices || [] }
          : i
      ),
    }));
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this line item and all its invoices?')) return;
    setDeletingId(itemId);
    const res = await fetch(`/api/line-items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      setDeal((prev) => ({
        ...prev,
        deal_line_items: (prev.deal_line_items || []).filter((i) => i.id !== itemId),
      }));
    }
    setDeletingId(null);
  };

  const handleDeleteDeal = async () => {
    if (!confirm(`Delete deal "${deal.deal_name}"? This will also delete all line items and invoices.`)) return;
    const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/deals');
  };

  const handleInvoiceAdded = (lineItemId, newInvoice) => {
    setDeal((prev) => ({
      ...prev,
      deal_line_items: prev.deal_line_items.map((item) =>
        item.id === lineItemId
          ? {
              ...item,
              line_item_invoices: [...(item.line_item_invoices || []), newInvoice].sort(
                (a, b) => new Date(a.invoice_date) - new Date(b.invoice_date)
              ),
            }
          : item
      ),
    }));
    setAddingInvoiceTo(null);
  };

  const handleDeleteInvoice = async (invoiceId, lineItemId) => {
    if (!confirm('Delete this invoice?')) return;
    setDeletingInvoiceId(invoiceId);
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
    if (res.ok) {
      setDeal((prev) => ({
        ...prev,
        deal_line_items: prev.deal_line_items.map((item) =>
          item.id === lineItemId
            ? {
                ...item,
                line_item_invoices: (item.line_item_invoices || []).filter(
                  (inv) => inv.id !== invoiceId
                ),
              }
            : item
        ),
      }));
    }
    setDeletingInvoiceId(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/deals" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Deals
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{deal.deal_name}</span>
      </div>

      {/* Deal Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{deal.deal_name}</h1>
              <StatusBadge status={deal.status} />
            </div>
            <p className="text-slate-500 mt-1 text-lg">{deal.customer_name}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
              <span>
                <span className="font-medium text-slate-700">Service:</span> {deal.service_type}
              </span>
              {deal.close_date && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(parseISO(deal.close_date), 'MMM d, yyyy')}
                  </span>
                </>
              )}
            </div>
            {deal.notes && (
              <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{deal.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEditDeal(true)} className="btn-secondary flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button onClick={handleDeleteDeal} className="btn-danger flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Commission Summary */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Total Commission</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(totalCommission)}</p>
          </div>
          <div className="text-center border-x border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Invoiced Commission</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(invoicedCommission)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Pending Commission</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(pendingCommission)}</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Line Items</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} ·{' '}
              {lineItems.filter((i) => (i.line_item_invoices || []).length > 0).length} with invoices
            </p>
          </div>
          <button onClick={() => setShowAddItem(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>

        {lineItems.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No line items yet.</p>
            <button onClick={() => setShowAddItem(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lineItems.map((item) => {
              const invoices = item.line_item_invoices || [];
              const invoicedAmount = invoices.reduce((s, inv) => s + parseFloat(inv.amount || 0), 0);
              const invoicedComm = invoices.reduce((s, inv) => s + parseFloat(inv.commission_amount || 0), 0);
              const isCollapsed = collapsedItems[item.id];

              return (
                <div key={item.id} className={item.is_excluded ? 'opacity-60' : ''}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: description + info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800">{item.description}</span>
                          <DealTypeBadge type={item.deal_type} />
                          {item.item_type && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              {item.item_type}
                            </span>
                          )}
                          {item.is_upsell && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              Upsell
                            </span>
                          )}
                          {item.deal_type === 'SoftwareResale' && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              Yr {item.year_number}
                            </span>
                          )}
                        </div>
                        {item.is_excluded && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
                            <AlertCircle className="w-3 h-3" />
                            {item.exclusion_reason}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          <span>
                            <span className="font-medium text-slate-700">{formatCurrency(item.amount)}</span> total
                          </span>
                          {item.gross_margin_percent != null && item.gross_margin_percent !== '' && (
                            <span>GM: {item.gross_margin_percent}%</span>
                          )}
                          {item.net_profit && (
                            <span>Net profit: {formatCurrency(item.net_profit)}</span>
                          )}
                          {!item.is_excluded && (
                            <span>
                              {(parseFloat(item.commission_rate || 0) * 100).toFixed(1)}% →{' '}
                              <span className="font-medium text-slate-700">
                                {formatCurrency(item.commission_amount)}
                              </span>{' '}
                              potential commission
                            </span>
                          )}
                        </div>
                        {!item.is_excluded && invoices.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-3 text-xs">
                            <span className="text-green-600 font-medium">
                              {formatCurrency(invoicedAmount)} invoiced
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(invoicedComm)} commission earned
                            </span>
                            {invoicedAmount < parseFloat(item.amount) && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-yellow-600">
                                  {formatCurrency(parseFloat(item.amount) - invoicedAmount)} remaining
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleCollapse(item.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          title={isCollapsed ? 'Show invoices' : 'Hide invoices'}
                        >
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Invoices */}
                    {!isCollapsed && (
                      <div className="mt-4 ml-4 border-l-2 border-slate-100 pl-4">
                        {invoices.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No invoices yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {invoices.map((inv) => (
                              <div key={inv.id} className="flex items-center justify-between py-1.5 text-sm">
                                <div className="flex items-center gap-3">
                                  <Receipt className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-slate-600">
                                    {format(parseISO(inv.invoice_date), 'MMM d, yyyy')}
                                  </span>
                                  <span className="font-medium text-slate-800">
                                    {formatCurrency(inv.amount)}
                                  </span>
                                  {!item.is_excluded && (
                                    <span className="text-green-600 text-xs">
                                      → {formatCurrency(inv.commission_amount)} commission
                                    </span>
                                  )}
                                  {inv.notes && (
                                    <span className="text-slate-400 text-xs">{inv.notes}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteInvoice(inv.id, item.id)}
                                  disabled={deletingInvoiceId === inv.id}
                                  className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                  title="Delete invoice"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {addingInvoiceTo === item.id ? (
                          <InvoiceForm
                            lineItem={item}
                            onAdd={(inv) => handleInvoiceAdded(item.id, inv)}
                            onCancel={() => setAddingInvoiceTo(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setAddingInvoiceTo(item.id)}
                            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Invoice
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lineItems.length > 0 && (
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Totals</span>
            <div className="flex items-center gap-6">
              <span>
                <span className="text-slate-500">Value: </span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(lineItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0))}
                </span>
              </span>
              <span>
                <span className="text-slate-500">Potential commission: </span>
                <span className="font-bold text-blue-600">{formatCurrency(totalCommission)}</span>
              </span>
              <span>
                <span className="text-slate-500">Invoiced: </span>
                <span className="font-bold text-green-600">{formatCurrency(invoicedCommission)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Deal Modal */}
      {showEditDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Edit Deal</h2>
            </div>
            <div className="p-6">
              <DealForm deal={deal} onSuccess={handleDealUpdated} onCancel={() => setShowEditDeal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Add Line Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Add Line Item</h2>
              <p className="text-sm text-slate-500 mt-1">{deal.customer_name} — {deal.service_type}</p>
            </div>
            <div className="p-6">
              <LineItemForm deal={deal} onSuccess={handleLineItemAdded} onCancel={() => setShowAddItem(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Line Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Edit Line Item</h2>
            </div>
            <div className="p-6">
              <LineItemForm
                deal={deal}
                lineItem={editingItem}
                onSuccess={handleLineItemUpdated}
                onCancel={() => setEditingItem(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
