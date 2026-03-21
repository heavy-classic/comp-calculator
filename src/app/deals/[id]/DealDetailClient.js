'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { formatCurrency, formatPercent, calculateLineItemCommission } from '@/lib/commission';
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

function LineItemStatusBadge({ status }) {
  if (status === 'Invoiced') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" /> Invoiced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

export default function DealDetailClient({ deal: initialDeal }) {
  const router = useRouter();
  const [deal, setDeal] = useState(initialDeal);
  const [showEditDeal, setShowEditDeal] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [savingStatus, setSavingStatus] = useState(null);

  const lineItems = deal.deal_line_items || [];
  const validItems = lineItems.filter((i) => !i.is_excluded);
  const totalCommission = validItems.reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const invoicedCommission = validItems
    .filter((i) => i.status === 'Invoiced')
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const pendingCommission = totalCommission - invoicedCommission;

  const handleDealUpdated = (updatedDeal) => {
    setDeal((prev) => ({ ...prev, ...updatedDeal }));
    setShowEditDeal(false);
  };

  const handleLineItemAdded = (newItem) => {
    setDeal((prev) => ({
      ...prev,
      deal_line_items: [...(prev.deal_line_items || []), newItem].sort((a, b) => {
        if (!a.invoice_date && !b.invoice_date) return 0;
        if (!a.invoice_date) return 1;
        if (!b.invoice_date) return -1;
        return new Date(a.invoice_date) - new Date(b.invoice_date);
      }),
    }));
    setShowAddItem(false);
  };

  const handleLineItemUpdated = (updatedItem) => {
    setDeal((prev) => ({
      ...prev,
      deal_line_items: (prev.deal_line_items || [])
        .map((i) => (i.id === updatedItem.id ? updatedItem : i))
        .sort((a, b) => {
          if (!a.invoice_date && !b.invoice_date) return 0;
          if (!a.invoice_date) return 1;
          if (!b.invoice_date) return -1;
          return new Date(a.invoice_date) - new Date(b.invoice_date);
        }),
    }));
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this line item?')) return;
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
    if (!confirm(`Delete deal "${deal.deal_name}"? This will also delete all line items.`)) return;

    const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/deals');
    }
  };

  const handleToggleItemStatus = async (item) => {
    const newStatus = item.status === 'Invoiced' ? 'Pending' : 'Invoiced';
    setSavingStatus(item.id);

    const res = await fetch(`/api/line-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, status: newStatus }),
    });

    if (res.ok) {
      const updated = await res.json();
      handleLineItemUpdated(updated);
    }
    setSavingStatus(null);
  };

  return (
    <div className="space-y-6 max-w-6xl">
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
              <span className="flex items-center gap-1">
                <span className="font-medium text-slate-700">Service:</span> {deal.service_type}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-slate-700">Type:</span> {deal.deal_type}
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
            <button
              onClick={() => setShowEditDeal(true)}
              className="btn-secondary flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={handleDeleteDeal}
              className="btn-danger flex items-center gap-1.5"
            >
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
              {lineItems.filter((i) => i.status === 'Invoiced').length} invoiced
            </p>
          </div>
          <button
            onClick={() => setShowAddItem(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>

        {lineItems.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No line items yet. Add your first line item.</p>
            <button
              onClick={() => setShowAddItem(true)}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Description</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Amount</th>
                  {deal.deal_type === 'SoftwareResale' && (
                    <th className="text-right py-3 px-4 text-slate-500 font-medium">Net Profit</th>
                  )}
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">GM%</th>
                  <th className="text-center py-3 px-4 text-slate-500 font-medium">Invoice Date</th>
                  <th className="text-center py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Rate</th>
                  <th className="text-right py-3 px-4 text-slate-500 font-medium">Commission</th>
                  <th className="text-center py-3 px-4 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 ${
                      item.is_excluded ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-slate-800">{item.description}</span>
                        {item.is_upsell && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            Upsell
                          </span>
                        )}
                        {deal.deal_type === 'SoftwareResale' && (
                          <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            Yr {item.year_number}
                          </span>
                        )}
                        {item.is_excluded && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-red-500">
                            <AlertCircle className="w-3 h-3" />
                            {item.exclusion_reason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                    {deal.deal_type === 'SoftwareResale' && (
                      <td className="py-3 px-4 text-right text-slate-600">
                        {item.net_profit ? formatCurrency(item.net_profit) : '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right text-slate-500">
                      {item.gross_margin_percent != null && item.gross_margin_percent !== ''
                        ? `${item.gross_margin_percent}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">
                      {item.invoice_date
                        ? format(parseISO(item.invoice_date), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleItemStatus(item)}
                        disabled={savingStatus === item.id}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        title="Click to toggle status"
                      >
                        <LineItemStatusBadge status={item.status} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {item.is_excluded ? '—' : `${(parseFloat(item.commission_rate || 0) * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-semibold ${
                          item.is_excluded ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(item.commission_amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
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
                    </td>
                  </tr>
                ))}
              </tbody>
              {lineItems.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="py-3 px-4 font-semibold text-slate-700" colSpan={deal.deal_type === 'SoftwareResale' ? 2 : 1}>
                      Total
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(lineItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0))}
                    </td>
                    {deal.deal_type === 'SoftwareResale' && <td />}
                    <td colSpan={4} />
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(totalCommission)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
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
              <DealForm
                deal={deal}
                onSuccess={handleDealUpdated}
                onCancel={() => setShowEditDeal(false)}
              />
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
              <p className="text-sm text-slate-500 mt-1">
                Deal: {deal.customer_name} — {deal.deal_type} ({deal.service_type})
              </p>
            </div>
            <div className="p-6">
              <LineItemForm
                deal={deal}
                onSuccess={handleLineItemAdded}
                onCancel={() => setShowAddItem(false)}
              />
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
