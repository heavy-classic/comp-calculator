'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/commission';
import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, Briefcase, Clock } from 'lucide-react';

// ─── Color palettes ───────────────────────────────────────────────────────────
const DEAL_TYPE_COLORS = {
  Implementation: '#6366f1',
  Renewal: '#22c55e',
  'Software Resale': '#f97316',
};

const ITEM_TYPE_COLORS = {
  License: '#3b82f6',
  Support: '#22c55e',
  Maintenance: '#f59e0b',
  Consulting: '#a855f7',
  Other: '#94a3b8',
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#94a3b8'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CurrencyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value} deal{p.value !== 1 ? 's' : ''}
        </p>
      ))}
    </div>
  );
};

// ─── Data processing ──────────────────────────────────────────────────────────
function processData(deals, items, paychecks) {
  // Monthly commission: earned (invoiced) vs paid (paychecks)
  const commissionByMonth = {};
  const paidByMonth = {};

  for (const item of items) {
    if (item.is_excluded || item.status !== 'Invoiced' || !item.invoice_date) continue;
    const m = item.invoice_date.substring(0, 7);
    commissionByMonth[m] = (commissionByMonth[m] || 0) + parseFloat(item.commission_amount || 0);
  }
  for (const p of paychecks) {
    if (!p.pay_date) continue;
    const m = p.pay_date.substring(0, 7);
    paidByMonth[m] = (paidByMonth[m] || 0) + parseFloat(p.commission_amount || 0);
  }
  const allMonths = new Set([...Object.keys(commissionByMonth), ...Object.keys(paidByMonth)]);
  const monthlyCommission = Array.from(allMonths)
    .sort()
    .map((m) => ({
      month: format(parseISO(`${m}-01`), 'MMM yy'),
      Earned: Math.round((commissionByMonth[m] || 0) * 100) / 100,
      Paid: Math.round((paidByMonth[m] || 0) * 100) / 100,
    }));

  // Deals closed over time (grouped by close_date month + deal_type)
  const dealsByMonth = {};
  for (const deal of deals) {
    if (!deal.close_date) continue;
    const m = deal.close_date.substring(0, 7);
    if (!dealsByMonth[m]) dealsByMonth[m] = { month: m, Implementation: 0, Renewal: 0, 'Software Resale': 0 };
    dealsByMonth[m][deal.deal_type] = (dealsByMonth[m][deal.deal_type] || 0) + 1;
  }
  const dealsOverTime = Object.values(dealsByMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((d) => ({ ...d, month: format(parseISO(`${d.month}-01`), 'MMM yy') }));

  // Commission by service+deal type combination
  const typeMap = {};
  for (const item of items) {
    if (item.is_excluded) continue;
    const key = `${item.deals?.service_type || '?'} ${item.deals?.deal_type || '?'}`;
    typeMap[key] = (typeMap[key] || 0) + parseFloat(item.commission_amount || 0);
  }
  const commissionByType = Object.entries(typeMap)
    .map(([name, commission]) => ({ name, commission: Math.round(commission * 100) / 100 }))
    .sort((a, b) => b.commission - a.commission);

  // Item type breakdown (License / Support / Maintenance / Consulting / Other)
  const itemTypeMap = {};
  for (const item of items) {
    const type = item.item_type || 'Other';
    if (!itemTypeMap[type]) itemTypeMap[type] = { name: type, commission: 0, count: 0, amount: 0 };
    itemTypeMap[type].commission += parseFloat(item.commission_amount || 0);
    itemTypeMap[type].count += 1;
    itemTypeMap[type].amount += parseFloat(item.amount || 0);
  }
  const itemTypeData = Object.values(itemTypeMap)
    .map((t) => ({
      ...t,
      commission: Math.round(t.commission * 100) / 100,
      amount: Math.round(t.amount * 100) / 100,
      value: Math.round(t.commission * 100) / 100, // for PieChart
    }))
    .sort((a, b) => b.commission - a.commission);

  // Summary
  const invoicedItems = items.filter((i) => !i.is_excluded && i.status === 'Invoiced');
  const pendingItems = items.filter((i) => !i.is_excluded && i.status === 'Pending');
  const totalEarned = invoicedItems.reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const totalPaid = paychecks.reduce((s, p) => s + parseFloat(p.commission_amount || 0), 0);
  const totalPending = pendingItems.reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);

  return {
    monthlyCommission,
    dealsOverTime,
    commissionByType,
    itemTypeData,
    summary: {
      totalEarned,
      totalPaid,
      gap: totalEarned - totalPaid,
      totalPending,
      totalDeals: deals.length,
      closedDeals: deals.filter((d) => d.status !== 'Pending').length,
    },
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub, icon: Icon, color }) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{title}</p>
        <p className={`text-2xl font-bold ${colorMap[color].split(' ')[0]}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [deals, paychecks] = await Promise.all([
          fetch('/api/deals').then((r) => r.json()),
          fetch('/api/paychecks').then((r) => r.json()),
        ]);
        const dealsArr = Array.isArray(deals) ? deals : [];
        const paychecksArr = Array.isArray(paychecks) ? paychecks : [];
        // Flatten line items and attach parent deal reference
        const items = dealsArr.flatMap((deal) =>
          (deal.deal_line_items || []).map((item) => ({
            ...item,
            deals: {
              customer_name: deal.customer_name,
              deal_name: deal.deal_name,
              service_type: deal.service_type,
              deal_type: deal.deal_type,
            },
          }))
        );
        setData(processData(dealsArr, items, paychecksArr));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">Loading your data…</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center text-red-600">
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const { summary, monthlyCommission, dealsOverTime, commissionByType, itemTypeData } = data;
  const hasMonthly = monthlyCommission.length > 0;
  const hasDeals = dealsOverTime.length > 0;
  const hasTypes = commissionByType.length > 0;
  const hasItems = itemTypeData.length > 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 mt-1">Commission trends, deal performance, and compensation overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Commission Earned"
          value={formatCurrency(summary.totalEarned)}
          sub="From invoiced deals"
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Commission Paid"
          value={formatCurrency(summary.totalPaid)}
          sub="From paychecks"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Pending Commission"
          value={formatCurrency(summary.totalPending)}
          sub="Not yet invoiced"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Total Deals"
          value={summary.totalDeals}
          sub={`${summary.closedDeals} closed / invoiced`}
          icon={Briefcase}
          color="purple"
        />
      </div>

      {/* Commission Over Time */}
      <Section
        title="Commission Over Time"
        subtitle="Monthly commission earned from invoiced deals vs. commission paid in paychecks"
      >
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyCommission} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="earnedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#94a3b8' }} width={55} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Area type="monotone" dataKey="Earned" stroke="#3b82f6" strokeWidth={2} fill="url(#earnedGrad)" dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Paid" stroke="#22c55e" strokeWidth={2} fill="url(#paidGrad)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart msg="No invoiced line items or paychecks yet." />
        )}
      </Section>

      {/* Deals Over Time + Deal Type Commission side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Deals Closed Over Time"
          subtitle="Count of closed/invoiced deals by month and type"
        >
          {hasDeals ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dealsOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} />
                <Tooltip content={<CountTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Implementation" stackId="a" fill={DEAL_TYPE_COLORS.Implementation} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Renewal" stackId="a" fill={DEAL_TYPE_COLORS.Renewal} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Software Resale" stackId="a" fill={DEAL_TYPE_COLORS['Software Resale']} radius={[4, 4, 0, 0]} name="SW Resale" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart msg="No deals with a close date yet." />
          )}
        </Section>

        <Section
          title="Commission by Deal Category"
          subtitle="Total commission earned per service + deal type"
        >
          {hasTypes ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={commissionByType}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="commission" name="Commission" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart msg="No commission data yet." />
          )}
        </Section>
      </div>

      {/* Item Type Breakdown */}
      <Section
        title="Line Item Type Breakdown"
        subtitle="Commission and revenue split across license, support, maintenance, consulting, and other"
      >
        {hasItems ? (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Pie chart */}
            <div className="flex-shrink-0">
              <ResponsiveContainer width={260} height={260}>
                <PieChart>
                  <Pie
                    data={itemTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {itemTypeData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={ITEM_TYPE_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Stats table */}
            <div className="flex-1 w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-500 font-medium">Type</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Items</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Revenue</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {itemTypeData.map((row, i) => (
                    <tr key={row.name} className="border-b border-slate-50">
                      <td className="py-2.5 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ITEM_TYPE_COLORS[row.name] || PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="font-medium text-slate-700">{row.name}</span>
                      </td>
                      <td className="py-2.5 text-right text-slate-500">{row.count}</td>
                      <td className="py-2.5 text-right text-slate-600">{formatCurrency(row.amount)}</td>
                      <td className="py-2.5 text-right font-semibold text-blue-600">{formatCurrency(row.commission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-3 font-semibold text-slate-700">Total</td>
                    <td className="pt-3 text-right text-slate-500">
                      {itemTypeData.reduce((s, r) => s + r.count, 0)}
                    </td>
                    <td className="pt-3 text-right font-semibold text-slate-700">
                      {formatCurrency(itemTypeData.reduce((s, r) => s + r.amount, 0))}
                    </td>
                    <td className="pt-3 text-right font-semibold text-blue-700">
                      {formatCurrency(itemTypeData.reduce((s, r) => s + r.commission, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <EmptyChart msg="No line items with type data yet. Add line items to deals to see the breakdown." />
        )}
      </Section>
    </div>
  );
}

function EmptyChart({ msg }) {
  return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-sm text-slate-400 text-center">{msg}</p>
    </div>
  );
}
