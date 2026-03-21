import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/commission';
import Link from 'next/link';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  Briefcase,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DemoDataBanner from '@/components/DemoDataBanner';

async function getDashboardData() {
  const [dealsRes, lineItemsRes, paychecksRes] = await Promise.all([
    supabase.from('deals').select('*, deal_line_items(*)').order('created_at', { ascending: false }),
    supabase.from('deal_line_items').select('*'),
    supabase.from('paychecks').select('*').order('pay_date', { ascending: false }).limit(5),
  ]);

  const deals = dealsRes.data || [];
  const lineItems = lineItemsRes.data || [];
  const recentPaychecks = paychecksRes.data || [];

  // Calculate totals
  const totalCommissionDue = lineItems
    .filter((i) => !i.is_excluded)
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);

  const invoicedCommission = lineItems
    .filter((i) => !i.is_excluded && i.status === 'Invoiced')
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);

  const pendingCommission = lineItems
    .filter((i) => !i.is_excluded && i.status === 'Pending')
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);

  const totalPaid = recentPaychecks.reduce((s, p) => s + parseFloat(p.commission_amount || 0), 0);

  const dealsByStatus = {
    Pending: deals.filter((d) => d.status === 'Pending').length,
    Closed: deals.filter((d) => d.status === 'Closed').length,
    Invoiced: deals.filter((d) => d.status === 'Invoiced').length,
  };

  // Upcoming invoices (next 90 days)
  const today = new Date();
  const in90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const upcomingItems = lineItems
    .filter((i) => {
      if (!i.invoice_date || i.status === 'Invoiced') return false;
      const d = new Date(i.invoice_date);
      return d >= today && d <= in90;
    })
    .sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date))
    .slice(0, 5);

  return {
    totalCommissionDue,
    invoicedCommission,
    pendingCommission,
    totalPaid,
    dealsByStatus,
    totalDeals: deals.length,
    recentDeals: deals.slice(0, 5),
    upcomingItems,
  };
}

function StatusBadge({ status }) {
  const classes = {
    Pending: 'badge-pending',
    Closed: 'badge-closed',
    Invoiced: 'badge-invoiced',
  };
  return <span className={classes[status] || 'badge-pending'}>{status}</span>;
}

export default async function Dashboard() {
  const data = await getDashboardData();

  const metrics = [
    {
      label: 'Total Commission Due',
      value: formatCurrency(data.totalCommissionDue),
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'Across all deals & line items',
    },
    {
      label: 'Invoiced Commission',
      value: formatCurrency(data.invoicedCommission),
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      sub: 'Ready to be paid',
    },
    {
      label: 'Pending Commission',
      value: formatCurrency(data.pendingCommission),
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      sub: 'Not yet invoiced',
    },
    {
      label: 'Total Received',
      value: formatCurrency(data.totalPaid),
      icon: DollarSign,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'From paycheck records',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Commission summary and overview</p>
      </div>

      {/* Demo data banner */}
      <DemoDataBanner hasData={data.totalDeals > 0} />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{m.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{m.value}</p>
                <p className="text-xs text-slate-400 mt-1">{m.sub}</p>
              </div>
              <div className={`w-10 h-10 ${m.bg} rounded-lg flex items-center justify-center`}>
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Commission Gap Alert */}
      {data.invoicedCommission > data.totalPaid && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">Commission Gap Detected</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You have {formatCurrency(data.invoicedCommission - data.totalPaid)} in invoiced commission
              not yet matched to paycheck records. Check the{' '}
              <Link href="/comparison" className="underline font-medium">Comparison</Link> page for details.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Deal Status Summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              Deal Status
            </h2>
            <Link href="/deals" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {Object.entries(data.dealsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                </div>
                <span className="font-semibold text-slate-900">{count} deal{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 flex justify-between">
              <span className="text-sm text-slate-500">Total Deals</span>
              <span className="font-bold text-slate-900">{data.totalDeals}</span>
            </div>
          </div>
        </div>

        {/* Upcoming Invoices */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Upcoming Invoices (90 days)
            </h2>
            <Link href="/deals" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {data.upcomingItems.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No upcoming invoices in the next 90 days</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                      {item.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.invoice_date
                        ? format(parseISO(item.invoice_date), 'MMM d, yyyy')
                        : 'No date'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.commission_amount)}
                    </p>
                    <p className="text-xs text-slate-400">commission</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Deals */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recent Deals</h2>
          <Link href="/deals" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {data.recentDeals.length === 0 ? (
          <div className="text-center py-8">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No deals yet.</p>
            <Link href="/deals" className="mt-2 inline-block btn-primary">Add Your First Deal</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-slate-500 font-medium">Customer</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Deal</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Type</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Status</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDeals.map((deal) => {
                  const dealCommission = (deal.deal_line_items || [])
                    .filter((i) => !i.is_excluded)
                    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
                  return (
                    <tr key={deal.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 font-medium text-slate-900">{deal.customer_name}</td>
                      <td className="py-3 text-slate-600">
                        <Link href={`/deals/${deal.id}`} className="hover:text-blue-600 hover:underline">
                          {deal.deal_name}
                        </Link>
                      </td>
                      <td className="py-3 text-slate-500">
                        {deal.service_type} / {deal.deal_type}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={deal.status} />
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(dealCommission)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
