'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Briefcase, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/commission';
import DealForm from '@/components/DealForm';

function StatusBadge({ status }) {
  const classes = {
    Pending: 'badge-pending',
    Closed: 'badge-closed',
    Invoiced: 'badge-invoiced',
  };
  return <span className={classes[status] || 'badge-pending'}>{status}</span>;
}

export default function DealsClient({ initialDeals }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = deals.filter((d) => {
    const matchSearch =
      d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      d.deal_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDealCreated = (newDeal) => {
    setDeals((prev) => [{ ...newDeal, deal_line_items: [] }, ...prev]);
    setShowForm(false);
    router.push(`/deals/${newDeal.id}`);
  };

  const getDealCommission = (deal) => {
    return (deal.deal_line_items || [])
      .filter((i) => !i.is_excluded)
      .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  };

  const getDealInvoicedCommission = (deal) => {
    return (deal.deal_line_items || [])
      .filter((i) => !i.is_excluded && i.status === 'Invoiced')
      .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-slate-500 mt-1">{deals.length} deal{deals.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {/* New Deal Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">New Deal</h2>
              <p className="text-sm text-slate-500 mt-1">Add a new deal to track commissions</p>
            </div>
            <div className="p-6">
              <DealForm
                onSuccess={handleDealCreated}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer or deal name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['All', 'Pending', 'Closed', 'Invoiced'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Row */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Commission',
              value: formatCurrency(filtered.reduce((s, d) => s + getDealCommission(d), 0)),
              color: 'text-blue-600',
            },
            {
              label: 'Invoiced Commission',
              value: formatCurrency(filtered.reduce((s, d) => s + getDealInvoicedCommission(d), 0)),
              color: 'text-green-600',
            },
            {
              label: 'Pending Commission',
              value: formatCurrency(
                filtered.reduce((s, d) => s + getDealCommission(d) - getDealInvoicedCommission(d), 0)
              ),
              color: 'text-yellow-600',
            },
          ].map((m) => (
            <div key={m.label} className="card p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Deals List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {deals.length === 0 ? 'No deals yet' : 'No deals match your filters'}
          </p>
          {deals.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Deal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((deal) => {
            const totalComm = getDealCommission(deal);
            const invoicedComm = getDealInvoicedCommission(deal);
            const lineItems = deal.deal_line_items || [];
            const invoicedCount = lineItems.filter((i) => i.status === 'Invoiced').length;

            return (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="card p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all group block"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{deal.customer_name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 truncate">{deal.deal_name}</span>
                    <StatusBadge status={deal.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{deal.service_type} / {deal.deal_type}</span>
                    <span>·</span>
                    <span>{lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}</span>
                    {lineItems.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-green-600">{invoicedCount} invoiced</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-900">{formatCurrency(totalComm)}</p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(invoicedComm)} invoiced
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
