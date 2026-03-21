import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/commission';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { TrendingUp, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';

async function getComparisonData() {
  const [dealsRes, lineItemsRes, paychecksRes] = await Promise.all([
    supabase.from('deals').select('id, customer_name, deal_name, service_type, deal_type, status'),
    supabase
      .from('deal_line_items')
      .select('*, deals(customer_name, deal_name, service_type, deal_type)')
      .order('invoice_date', { ascending: true }),
    supabase.from('paychecks').select('*').order('pay_date', { ascending: false }),
  ]);

  const lineItems = lineItemsRes.data || [];
  const paychecks = paychecksRes.data || [];

  // Commission owed (invoiced line items)
  const invoicedItems = lineItems.filter((i) => !i.is_excluded && i.status === 'Invoiced');
  const totalCommissionInvoiced = invoicedItems.reduce(
    (s, i) => s + parseFloat(i.commission_amount || 0),
    0
  );

  // Total from paychecks
  const totalCommissionPaid = paychecks.reduce(
    (s, p) => s + parseFloat(p.commission_amount || 0),
    0
  );

  const gap = totalCommissionInvoiced - totalCommissionPaid;

  // Group invoiced items by month for timeline
  const byMonth = {};
  for (const item of invoicedItems) {
    if (!item.invoice_date) continue;
    const month = item.invoice_date.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = { month, items: [], total: 0 };
    byMonth[month].items.push(item);
    byMonth[month].total += parseFloat(item.commission_amount || 0);
  }

  // Group paychecks by month
  const paychecksByMonth = {};
  for (const p of paychecks) {
    if (!p.pay_date) continue;
    const month = p.pay_date.substring(0, 7);
    if (!paychecksByMonth[month]) paychecksByMonth[month] = { month, paychecks: [], total: 0 };
    paychecksByMonth[month].paychecks.push(p);
    paychecksByMonth[month].total += parseFloat(p.commission_amount || 0);
  }

  // Merge months
  const allMonths = new Set([...Object.keys(byMonth), ...Object.keys(paychecksByMonth)]);
  const timeline = Array.from(allMonths)
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({
      month,
      commissionDue: byMonth[month]?.total || 0,
      commissionPaid: paychecksByMonth[month]?.total || 0,
      items: byMonth[month]?.items || [],
      paychecks: paychecksByMonth[month]?.paychecks || [],
    }));

  // Pending items (not yet invoiced)
  const pendingItems = lineItems
    .filter((i) => !i.is_excluded && i.status === 'Pending')
    .slice(0, 10);
  const totalPending = lineItems
    .filter((i) => !i.is_excluded && i.status === 'Pending')
    .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);

  return {
    totalCommissionInvoiced,
    totalCommissionPaid,
    gap,
    timeline,
    pendingItems,
    totalPending,
    totalDeals: (dealsRes.data || []).length,
  };
}

function GapIndicator({ gap }) {
  if (gap > 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-800">Under-paid by {formatCurrency(gap)}</p>
          <p className="text-sm text-amber-600 mt-1">
            You have {formatCurrency(gap)} more in invoiced commission than what's been recorded
            in your paychecks. Review your paychecks to confirm if any are missing or have
            incorrect amounts.
          </p>
        </div>
      </div>
    );
  }
  if (gap < 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
        <TrendingUp className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-800">
            Paychecks exceed invoiced by {formatCurrency(Math.abs(gap))}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            Your paycheck commission records exceed your invoiced deal commissions.
            You may have deals not yet entered, or paychecks from before tracked deals.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-green-800">Commission is balanced</p>
        <p className="text-sm text-green-600 mt-1">
          Your invoiced commission matches your paycheck records.
        </p>
      </div>
    </div>
  );
}

export default async function ComparisonPage() {
  const data = await getComparisonData();

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commission Comparison</h1>
        <p className="text-slate-500 mt-1">
          Compare commissions earned from deals vs. what's been paid in paychecks
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Invoiced Commission</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(data.totalCommissionInvoiced)}
          </p>
          <p className="text-xs text-slate-400 mt-1">From invoiced deal line items</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Commission in Paychecks</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(data.totalCommissionPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">From paycheck records</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-xs text-slate-500 mb-1">Difference (Gap)</p>
          <p
            className={`text-2xl font-bold ${
              data.gap > 0 ? 'text-amber-600' : data.gap < 0 ? 'text-blue-600' : 'text-green-600'
            }`}
          >
            {data.gap >= 0 ? '' : '-'}
            {formatCurrency(Math.abs(data.gap))}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {data.gap > 0 ? 'Owed to you' : data.gap < 0 ? 'Over-paid' : 'Balanced'}
          </p>
        </div>
      </div>

      {/* Gap Indicator */}
      <GapIndicator gap={data.gap} />

      {/* Pending Commission */}
      {data.totalPending > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Upcoming Commissions (Not Yet Invoiced)
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            These line items are pending invoicing. Total:{' '}
            <strong className="text-yellow-600">{formatCurrency(data.totalPending)}</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-slate-500 font-medium">Deal</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Description</th>
                  <th className="text-center py-2 text-slate-500 font-medium">Invoice Date</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-600">
                      {item.deals?.customer_name || '—'}
                    </td>
                    <td className="py-2 text-slate-700">{item.description}</td>
                    <td className="py-2 text-center text-slate-500">
                      {item.invoice_date
                        ? format(parseISO(item.invoice_date), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="py-2 text-right font-semibold text-yellow-600">
                      {formatCurrency(item.commission_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Timeline */}
      {data.timeline.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Monthly Breakdown</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Commission earned vs. commission paid by month
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {data.timeline.map((row) => {
              const monthGap = row.commissionDue - row.commissionPaid;
              const monthLabel = format(parseISO(`${row.month}-01`), 'MMMM yyyy');

              return (
                <div key={row.month} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-slate-900">{monthLabel}</h3>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Earned</p>
                        <p className="font-semibold text-blue-600">
                          {formatCurrency(row.commissionDue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Paid</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(row.commissionPaid)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Gap</p>
                        <p
                          className={`font-semibold ${
                            monthGap > 0.01
                              ? 'text-amber-600'
                              : monthGap < -0.01
                              ? 'text-blue-600'
                              : 'text-green-600'
                          }`}
                        >
                          {monthGap >= 0 ? '' : '-'}
                          {formatCurrency(Math.abs(monthGap))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {(row.commissionDue > 0 || row.commissionPaid > 0) && (
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                      {row.commissionDue > 0 && (
                        <div
                          className="absolute left-0 top-0 h-full bg-blue-200 rounded-full"
                          style={{ width: '100%' }}
                        />
                      )}
                      {row.commissionDue > 0 && (
                        <div
                          className="absolute left-0 top-0 h-full bg-green-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              (row.commissionPaid / row.commissionDue) * 100,
                              100
                            )}%`,
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Line items for this month */}
                  {row.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {row.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs text-slate-500 pl-2"
                        >
                          <span>
                            📌 {item.deals?.customer_name || '—'}: {item.description}
                          </span>
                          <span className="font-medium text-slate-700">
                            {formatCurrency(item.commission_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Paychecks for this month */}
                  {row.paychecks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {row.paychecks.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-xs text-slate-500 pl-2"
                        >
                          <span>
                            💰 Paycheck{p.file_name ? ` (${p.file_name})` : ''}
                          </span>
                          <span className="font-medium text-green-700">
                            {formatCurrency(p.commission_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.timeline.length === 0 && (
        <div className="card p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No data to compare yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add deals with invoiced line items and upload paychecks to see your comparison.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Link href="/deals" className="btn-primary">Add Deals</Link>
            <Link href="/paychecks" className="btn-secondary">Upload Paychecks</Link>
          </div>
        </div>
      )}
    </div>
  );
}
